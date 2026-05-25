// Package config 从 config.yaml 加载应用配置，并从 .env 文件加载
// 敏感密钥。这样可以让密钥不进入代码和版本控制，同时把其余配置
// 以 YAML 形式提交。
package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v3"
)

// AppConfig 是顶层配置容器。
type AppConfig struct {
	Server    ServerConfig    `yaml:"server"`
	LLM       LLMConfig       `yaml:"llm"`
	RateLimit RateLimitConfig `yaml:"rate_limit"`
	Game      GameConfig      `yaml:"game"`
}

// ServerConfig 保存 HTTP server 设置。
type ServerConfig struct {
	Port         int      `yaml:"port"`
	ReadTimeout  int      `yaml:"read_timeout"`  // 秒
	WriteTimeout int      `yaml:"write_timeout"` // 秒
	CORSOrigins  []string `yaml:"cors_origins"`
}

// LLMConfig 保存从 YAML 加载的 LLM provider 设置。
// API key 和 base URL 来自环境变量。
type LLMConfig struct {
	Provider    string  `yaml:"provider"`
	Model       string  `yaml:"model"`
	MaxTokens   int     `yaml:"max_tokens"`
	Temperature float64 `yaml:"temperature"`
	Timeout     int     `yaml:"timeout"` // 秒

	// 在加载时从 .env 填充。
	APIKey  string `yaml:"-"`
	BaseURL string `yaml:"-"`
}

// RateLimitConfig 控制 token-bucket rate limiter。
type RateLimitConfig struct {
	RequestsPerSecond float64 `yaml:"requests_per_second"`
	Burst             int     `yaml:"burst"`
}

// GameConfig 保存游戏相关参数。
type GameConfig struct {
	QuestionsPerRound   int     `yaml:"questions_per_round"`
	ConflictWindowSize  int     `yaml:"conflict_window_size"`
	MetaBaseProbability float64 `yaml:"meta_base_probability"`
	MetaObsessionFactor float64 `yaml:"meta_obsession_factor"`
}

// ReadTimeout 将 server read timeout 转为 time.Duration。
func (s ServerConfig) ReadTimeoutDuration() time.Duration {
	return time.Duration(s.ReadTimeout) * time.Second
}

// WriteTimeout 将 server write timeout 转为 time.Duration。
func (s ServerConfig) WriteTimeoutDuration() time.Duration {
	return time.Duration(s.WriteTimeout) * time.Second
}

// LLMTimeout 将 LLM HTTP client timeout 转为 time.Duration。
func (l LLMConfig) LLMTimeout() time.Duration {
	return time.Duration(l.Timeout) * time.Second
}

// Load 先从 configPath 读取 config.yaml，再加载 .env（如果存在）
// 来填充密钥字段。它会返回已完全解析的 AppConfig。
func Load(configPath string) (*AppConfig, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("config: read %s: %w", configPath, err)
	}

	var cfg AppConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("config: parse yaml: %w", err)
	}

	// 如果存在则加载 .env 文件（尽力而为，缺失也不致命）。
	_ = godotenv.Load()

	cfg.LLM.APIKey = os.Getenv("LLM_API_KEY")
	if cfg.LLM.APIKey == "" {
		return nil, fmt.Errorf("config: LLM_API_KEY environment variable is required")
	}

	cfg.LLM.BaseURL = os.Getenv("LLM_BASE_URL")
	if cfg.LLM.BaseURL == "" {
		cfg.LLM.BaseURL = "https://api.openai.com/v1"
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// validate 检查必填字段是否具有合理值。
func (c *AppConfig) validate() error {
	if c.Server.Port <= 0 || c.Server.Port > 65535 {
		return fmt.Errorf("config: server.port must be 1-65535, got %d", c.Server.Port)
	}
	if c.LLM.Model == "" {
		return fmt.Errorf("config: llm.model is required")
	}
	if c.LLM.MaxTokens <= 0 {
		return fmt.Errorf("config: llm.max_tokens must be positive")
	}
	if c.LLM.Temperature < 0 || c.LLM.Temperature > 2 {
		return fmt.Errorf("config: llm.temperature must be 0-2")
	}
	return nil
}
