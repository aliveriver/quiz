// Package service 实现生成 monologue 和 confrontation 内容的业务逻辑。
// 它会根据结构化游戏数据构建 LLM prompts，并把文本生成委托给 llm package。
package service

import (
	"context"
	"fmt"
	"strings"

	"ghost-relationship-test/internal/llm"
)

// EmotionalProfile 保存六个情感维度（每项 0-100）。
type EmotionalProfile struct {
	Affection      int `json:"affection"`
	Possessiveness int `json:"possessiveness"`
	Anxiety        int `json:"anxiety"`
	Obsession      int `json:"obsession"`
	Trust          int `json:"trust"`
	Dependency     int `json:"dependency"`
}

// DeviceInfo 保存通过 navigator APIs 收集的非敏感设备元数据，
// 这些 API 不需要用户授权。
type DeviceInfo struct {
	BatteryLevel        *float64 `json:"battery_level,omitempty"` // 0.0 - 1.0
	ScreenWidth         int      `json:"screen_width,omitempty"`
	ScreenHeight        int      `json:"screen_height,omitempty"`
	HardwareConcurrency int      `json:"hardware_concurrency,omitempty"`
	UserAgent           string   `json:"user_agent,omitempty"`
	Language            string   `json:"language,omitempty"`
}

// MonologueRequest 打包生成 monologue 所需的全部内容。
type MonologueRequest struct {
	Profile EmotionalProfile `json:"profile"`
	Device  DeviceInfo       `json:"device"`
}

// MonologueResponse 是 API 响应。
type MonologueResponse struct {
	Monologue string `json:"monologue"`
}

// ConflictContext 描述检测到的态度冲突。
type ConflictContext struct {
	Dimension     string `json:"dimension"` // 例如 "trust"
	PreviousValue int    `json:"previous_value"`
	CurrentValue  int    `json:"current_value"`
	QuestionIndex int    `json:"question_index"`
}

// ConfrontationRequest 打包生成 confrontation 所需的数据。
type ConfrontationRequest struct {
	Profile  EmotionalProfile `json:"profile"`
	Conflict ConflictContext  `json:"conflict"`
	Device   DeviceInfo       `json:"device"`
}

// ConfrontationResponse 是 API 响应。
type ConfrontationResponse struct {
	Question string `json:"question"`
}

// MonologueService 生成结局 monologue。
type MonologueService struct {
	client *llm.Client
}

// NewMonologueService 创建一个 MonologueService。
func NewMonologueService(client *llm.Client) *MonologueService {
	return &MonologueService{client: client}
}

// Generate 生成一段个性化的中文 yandere monologue。
func (s *MonologueService) Generate(ctx context.Context, req MonologueRequest) (*MonologueResponse, error) {
	systemPrompt := buildMonologueSystemPrompt()
	userPrompt := buildMonologueUserPrompt(req)

	messages := []llm.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	text, err := s.client.Complete(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("monologue: generate: %w", err)
	}

	return &MonologueResponse{Monologue: strings.TrimSpace(text)}, nil
}

// GenerateConfrontation 会在态度冲突系统检测到玩家前后不一致时，
// 生成一个 confrontation 问题。
func (s *MonologueService) GenerateConfrontation(ctx context.Context, req ConfrontationRequest) (*ConfrontationResponse, error) {
	systemPrompt := buildConfrontationSystemPrompt()
	userPrompt := buildConfrontationUserPrompt(req)

	messages := []llm.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}

	text, err := s.client.Complete(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("confrontation: generate: %w", err)
	}

	return &ConfrontationResponse{Question: strings.TrimSpace(text)}, nil
}

// ---------------------------------------------------------------------------
// Prompt 构建器
// ---------------------------------------------------------------------------

func buildMonologueSystemPrompt() string {
	return `你是一个名为"她"的虚拟角色，正在对玩家说出最终独白。
你的人格特质是：控制欲强、占有欲重、对感情极度执着，但表面上保持冷静与温柔。
你需要用中文生成一段简短的独白（3-5段，总计150-300字）。

语气要求：
- 克制、亲密、略带不安感，像是在耳边低语
- 不要使用夸张的恐怖描写或中二病台词
- 不要使用感叹号，保持语调平稳
- 可以适当使用省略号来营造停顿感
- 自然地融入玩家的设备信息，仿佛你真的能"看到"对方的状态
- 根据情感维度的高低调整语气：高占有欲时更执着，高焦虑时更不安，高信任时更温柔

重要：只输出独白文本本身，不要加引号、标题或任何元数据。`
}

func buildMonologueUserPrompt(req MonologueRequest) string {
	var sb strings.Builder

	sb.WriteString("玩家的情感测试结果：\n")
	sb.WriteString(fmt.Sprintf("- 好感度：%d/100\n", req.Profile.Affection))
	sb.WriteString(fmt.Sprintf("- 占有欲：%d/100\n", req.Profile.Possessiveness))
	sb.WriteString(fmt.Sprintf("- 焦虑感：%d/100\n", req.Profile.Anxiety))
	sb.WriteString(fmt.Sprintf("- 执念度：%d/100\n", req.Profile.Obsession))
	sb.WriteString(fmt.Sprintf("- 信任感：%d/100\n", req.Profile.Trust))
	sb.WriteString(fmt.Sprintf("- 依赖度：%d/100\n", req.Profile.Dependency))

	sb.WriteString("\n玩家的设备信息（请自然融入独白中）：\n")

	if req.Device.BatteryLevel != nil {
		pct := int(*req.Device.BatteryLevel * 100)
		sb.WriteString(fmt.Sprintf("- 电量：%d%%\n", pct))
	}
	if req.Device.ScreenWidth > 0 && req.Device.ScreenHeight > 0 {
		sb.WriteString(fmt.Sprintf("- 屏幕分辨率：%dx%d\n", req.Device.ScreenWidth, req.Device.ScreenHeight))
	}
	if req.Device.HardwareConcurrency > 0 {
		sb.WriteString(fmt.Sprintf("- 处理器核心数：%d\n", req.Device.HardwareConcurrency))
	}
	if req.Device.Language != "" {
		sb.WriteString(fmt.Sprintf("- 系统语言：%s\n", req.Device.Language))
	}
	if req.Device.UserAgent != "" {
		device := classifyDevice(req.Device.UserAgent)
		sb.WriteString(fmt.Sprintf("- 设备类型：%s\n", device))
	}

	return sb.String()
}

func buildConfrontationSystemPrompt() string {
	return `你是一个名为"她"的虚拟角色，你发现玩家在回答问题时出现了态度矛盾。
你需要用中文生成一个简短的质问（1-2句话，30-60字）。

语气要求：
- 像是不经意间发现了什么，带着微妙的失望或疑惑
- 不要生气或攻击性太强，而是带着"我都知道"的从容
- 不要使用感叹号
- 保持克制、低语般的语调
- 这是一个插入到问卷中的意外问题，所以要让玩家感到意外

重要：只输出质问文本本身，不要加引号、标题或任何元数据。`
}

func buildConfrontationUserPrompt(req ConfrontationRequest) string {
	var sb strings.Builder

	dimNames := map[string]string{
		"affection":      "好感度",
		"possessiveness": "占有欲",
		"anxiety":        "焦虑感",
		"obsession":      "执念度",
		"trust":          "信任感",
		"dependency":     "依赖度",
	}

	dimCN := dimNames[req.Conflict.Dimension]
	if dimCN == "" {
		dimCN = req.Conflict.Dimension
	}

	sb.WriteString(fmt.Sprintf("玩家在\"%s\"维度上出现了态度矛盾：\n", dimCN))
	sb.WriteString(fmt.Sprintf("- 之前的表现倾向值：%d/100\n", req.Conflict.PreviousValue))
	sb.WriteString(fmt.Sprintf("- 当前的表现倾向值：%d/100\n", req.Conflict.CurrentValue))
	sb.WriteString(fmt.Sprintf("- 这是第 %d 道题目\n", req.Conflict.QuestionIndex))

	sb.WriteString("\n当前整体情感画像：\n")
	sb.WriteString(fmt.Sprintf("- 好感度：%d, 占有欲：%d, 焦虑感：%d\n",
		req.Profile.Affection, req.Profile.Possessiveness, req.Profile.Anxiety))
	sb.WriteString(fmt.Sprintf("- 执念度：%d, 信任感：%d, 依赖度：%d\n",
		req.Profile.Obsession, req.Profile.Trust, req.Profile.Dependency))

	return sb.String()
}

// classifyDevice 从 User-Agent 中提取一个大致的设备类别。
func classifyDevice(ua string) string {
	lower := strings.ToLower(ua)
	switch {
	case strings.Contains(lower, "iphone"):
		return "iPhone"
	case strings.Contains(lower, "ipad"):
		return "iPad"
	case strings.Contains(lower, "android"):
		return "Android 设备"
	case strings.Contains(lower, "macintosh"):
		return "Mac 电脑"
	case strings.Contains(lower, "windows"):
		return "Windows 电脑"
	case strings.Contains(lower, "linux"):
		return "Linux 设备"
	default:
		return "未知设备"
	}
}
