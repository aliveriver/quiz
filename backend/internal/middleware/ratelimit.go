package middleware

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiter 实现一个按 client IP 计数的简单 token-bucket rate limiter。
// 它可安全用于并发场景。
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     float64 // 每秒增加的 tokens
	burst    int     // 最大 tokens 数
	cleanTTL time.Duration
}

type bucket struct {
	tokens   float64
	lastSeen time.Time
}

// NewRateLimiter 创建一个 rate limiter，允许每秒 `rate` 次请求，
// 最大 burst 为 `burst`。
func NewRateLimiter(rate float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		buckets:  make(map[string]*bucket),
		rate:     rate,
		burst:    burst,
		cleanTTL: 5 * time.Minute,
	}

	// 后台 goroutine，用于清理过期 bucket。
	go rl.cleanup()

	return rl
}

// Middleware 返回一个 http.Handler middleware，
// 对超过 rate limit 的请求返回 429 Too Many Requests。
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)

		if !rl.allow(ip) {
			w.Header().Set("Retry-After", "1")
			http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// allow 检查给定 key 是否还有可用 tokens。
func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, exists := rl.buckets[key]
	if !exists {
		rl.buckets[key] = &bucket{
			tokens:   float64(rl.burst) - 1,
			lastSeen: now,
		}
		return true
	}

	// 根据经过时间补充 tokens。
	elapsed := now.Sub(b.lastSeen).Seconds()
	b.tokens += elapsed * rl.rate
	if b.tokens > float64(rl.burst) {
		b.tokens = float64(rl.burst)
	}
	b.lastSeen = now

	if b.tokens < 1 {
		return false
	}

	b.tokens--
	return true
}

// cleanup 定期移除陈旧的 bucket 条目。
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.cleanTTL)
		for key, b := range rl.buckets {
			if b.lastSeen.Before(cutoff) {
				delete(rl.buckets, key)
			}
		}
		rl.mu.Unlock()
	}
}

// extractIP 从请求中返回 client IP，
// 在 reverse proxy 后优先使用 X-Forwarded-For。
func extractIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// 取链中的第一个 IP（原始客户端）。
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}

	// 回退到 RemoteAddr（host:port）。
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}
