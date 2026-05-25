// Package handler 定义 HTTP route handlers，负责把传入的
// JSON 请求转到 service layer，并返回 JSON 响应。
package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"ghost-relationship-test/internal/config"
	"ghost-relationship-test/internal/service"
)

// Handler 保存对 service 和配置的引用。
type Handler struct {
	monologueSvc *service.MonologueService
	gameCfg      config.GameConfig
}

// New 使用给定依赖创建 Handler。
func New(svc *service.MonologueService, gameCfg config.GameConfig) *Handler {
	return &Handler{
		monologueSvc: svc,
		gameCfg:      gameCfg,
	}
}

// HealthCheck 返回 200 OK，用于 Docker health checks 和 load
// balancer probes。
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// GameConfig 返回前端需要的公开游戏设置。
func (h *Handler) GameConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, h.gameCfg)
}

// GenerateMonologue 处理 POST /api/generate-monologue。
func (h *Handler) GenerateMonologue(w http.ResponseWriter, r *http.Request) {
	var req service.MonologueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if err := validateProfile(req.Profile); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	resp, err := h.monologueSvc.Generate(r.Context(), req)
	if err != nil {
		log.Printf("ERROR generate monologue: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to generate monologue")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// GenerateConfrontation 处理 POST /api/generate-confrontation。
func (h *Handler) GenerateConfrontation(w http.ResponseWriter, r *http.Request) {
	var req service.ConfrontationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if err := validateProfile(req.Profile); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	resp, err := h.monologueSvc.GenerateConfrontation(r.Context(), req)
	if err != nil {
		log.Printf("ERROR generate confrontation: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to generate confrontation")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

func validateProfile(p service.EmotionalProfile) error {
	check := func(name string, v int) error {
		if v < 0 || v > 100 {
			return &validationError{field: name, msg: "must be 0-100"}
		}
		return nil
	}

	for _, c := range []struct {
		name string
		val  int
	}{
		{"affection", p.Affection},
		{"possessiveness", p.Possessiveness},
		{"anxiety", p.Anxiety},
		{"obsession", p.Obsession},
		{"trust", p.Trust},
		{"dependency", p.Dependency},
	} {
		if err := check(c.name, c.val); err != nil {
			return err
		}
	}
	return nil
}

type validationError struct {
	field string
	msg   string
}

func (e *validationError) Error() string {
	return e.field + ": " + e.msg
}

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("ERROR writeJSON: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}
