package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"ghost-relationship-test/internal/metrics"
	"ghost-relationship-test/internal/service"
)

// StreamHandler 持有流式 SSE 端点所需的依赖。
type StreamHandler struct {
	monologueSvc *service.MonologueService
	metrics      *metrics.Metrics
}

// NewStreamHandler 创建 StreamHandler。
func NewStreamHandler(svc *service.MonologueService, m *metrics.Metrics) *StreamHandler {
	return &StreamHandler{
		monologueSvc: svc,
		metrics:      m,
	}
}

// StreamMonologue 处理 POST /api/stream-monologue，以 SSE 逐 chunk 推送生成文本。
func (sh *StreamHandler) StreamMonologue(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	var req service.MonologueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := validateProfile(req.Profile); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	start := time.Now()

	err := sh.monologueSvc.GenerateStream(r.Context(), req, func(text string) {
		chunk, _ := json.Marshal(map[string]string{"text": text})
		fmt.Fprintf(w, "data: %s\n\n", chunk)
		flusher.Flush()
	})

	duration := time.Since(start)
	sh.metrics.Record(duration, err)

	if err != nil {
		log.Printf("ERROR stream monologue: %v", err)
		fmt.Fprintf(w, "data: {\"error\":\"%s\"}\n\n", "generation failed")
		flusher.Flush()
		return
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}
