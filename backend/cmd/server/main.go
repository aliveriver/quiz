// Command server 是 Ghost Relationship Test backend 的入口。
// 它会加载配置、组装依赖、注册 routes，并启动 HTTP server。
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"ghost-relationship-test/internal/config"
	"ghost-relationship-test/internal/handler"
	"ghost-relationship-test/internal/llm"
	"ghost-relationship-test/internal/metrics"
	"ghost-relationship-test/internal/middleware"
	"ghost-relationship-test/internal/service"
	"ghost-relationship-test/internal/tts"
)

func main() {
	// 确定 config path（可通过环境变量覆盖）。
	cfgPath := os.Getenv("CONFIG_PATH")
	if cfgPath == "" {
		cfgPath = "config.yaml"
	}

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// ---- 构建依赖图 ----

	llmClient := llm.NewClient(llm.ClientConfig{
		BaseURL:     cfg.LLM.BaseURL,
		APIKey:      cfg.LLM.APIKey,
		Model:       cfg.LLM.Model,
		MaxTokens:   cfg.LLM.MaxTokens,
		Temperature: cfg.LLM.Temperature,
		Timeout:     cfg.LLM.LLMTimeout(),
	})

	monologueSvc := service.NewMonologueService(llmClient)
	m := metrics.New()
	h := handler.New(monologueSvc, cfg.Game)

	// ---- TTS（可选）----
	// 仅当配置了 TTS_API_KEY 时才启用 TTS 管线。
	var ttsPipeline *service.TTSPipeline
	if cfg.TTS.APIKey != "" {
		ttsClient := tts.NewClient(tts.Config{
			WSURL:      cfg.TTS.WSURL,
			APIKey:     cfg.TTS.APIKey,
			Model:      cfg.TTS.Model,
			Voice:      cfg.TTS.Voice,
			Speed:      cfg.TTS.Speed,
			Vol:        cfg.TTS.Vol,
			Pitch:      cfg.TTS.Pitch,
			Format:     cfg.TTS.Format,
			SampleRate: cfg.TTS.SampleRate,
			Bitrate:    cfg.TTS.Bitrate,
		})
		ttsPipeline = service.NewTTSPipeline(monologueSvc, ttsClient)
		log.Println("TTS enabled (MiniMax WebSocket)")
	} else {
		log.Println("TTS disabled (TTS_API_KEY not set)")
	}

	sh := handler.NewStreamHandler(monologueSvc, ttsPipeline, m)

	// ---- Router ----

	r := chi.NewRouter()

	// 全局 middleware 栈（顺序很重要）。
	r.Use(middleware.Logger)
	r.Use(middleware.CORS(cfg.Server.CORSOrigins))
	r.Use(middleware.NewRateLimiter(
		cfg.RateLimit.RequestsPerSecond,
		cfg.RateLimit.Burst,
	).Middleware)

	// 路由。
	r.Get("/health", h.HealthCheck)
	r.Get("/api/game-config", h.GameConfig)
	r.Post("/api/generate-monologue", h.GenerateMonologue)
	r.Post("/api/generate-confrontation", h.GenerateConfrontation)
	r.Post("/api/stream-monologue", sh.StreamMonologue)
	r.Post("/api/stream-monologue-tts", sh.StreamMonologueWithTTS)

	// ---- Server ----

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeoutDuration(),
		WriteTimeout: cfg.Server.WriteTimeoutDuration(),
		IdleTimeout:  60 * time.Second,
	}

	// 在 SIGINT / SIGTERM 下优雅关闭。
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("server starting on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-done
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}

	log.Println("server stopped")
}
