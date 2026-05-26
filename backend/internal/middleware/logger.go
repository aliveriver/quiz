package middleware

import (
	"log"
	"net/http"
	"time"
)

// statusWriter 封装 http.ResponseWriter，用于捕获 status code。
type statusWriter struct {
	http.ResponseWriter
	code int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.code = code
	sw.ResponseWriter.WriteHeader(code)
}

// Flush 实现 http.Flusher 接口，将写入内容立即发送到客户端（SSE 必需）。
func (sw *statusWriter) Flush() {
	if f, ok := sw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Logger 返回一个 middleware，用于记录每个请求的 method、path、
// status code、duration 和 client IP。
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		sw := &statusWriter{ResponseWriter: w, code: http.StatusOK}
		next.ServeHTTP(sw, r)

		log.Printf("[%s] %s %s | %d | %s | %s",
			r.Method,
			r.URL.Path,
			r.Proto,
			sw.code,
			time.Since(start).Round(time.Millisecond),
			extractIP(r),
		)
	})
}
