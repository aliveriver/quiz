// Package metrics 提供一个轻量的进程内 LLM 调用监控收集器。
// 不依赖任何外部库，统计数据通过日志输出。
package metrics

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// Metrics 收集 LLM 调用的聚合统计数据。所有操作均线程安全。
type Metrics struct {
	mu            sync.Mutex
	TotalRequests int64
	TotalSuccess  int64
	TotalFailures int64
	LatencySum    time.Duration
	LatencyCount  int64
	LatencyMax    time.Duration
}

// MetricsSnapshot 是某一时刻统计数据的不可变快照。
type MetricsSnapshot struct {
	TotalRequests int64
	TotalSuccess  int64
	TotalFailures int64
	SuccessRate   float64
	AvgLatency    time.Duration
	MaxLatency    time.Duration
}

// New 创建一个空的 Metrics 实例。
func New() *Metrics {
	return &Metrics{}
}

// Record 记录一次 LLM 调用的结果（延迟和是否出错），
// 并将最新统计信息打印到日志。
func (m *Metrics) Record(duration time.Duration, err error) {
	m.mu.Lock()
	m.TotalRequests++
	if err != nil {
		m.TotalFailures++
	} else {
		m.TotalSuccess++
	}
	m.LatencySum += duration
	m.LatencyCount++
	if duration > m.LatencyMax {
		m.LatencyMax = duration
	}
	snap := m.snapshot()
	m.mu.Unlock()

	m.log(snap, duration, err)
}

// Snapshot 返回当前统计数据的快照（加锁）。
func (m *Metrics) Snapshot() MetricsSnapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.snapshot()
}

// snapshot 返回快照，调用方必须持有锁。
func (m *Metrics) snapshot() MetricsSnapshot {
	snap := MetricsSnapshot{
		TotalRequests: m.TotalRequests,
		TotalSuccess:  m.TotalSuccess,
		TotalFailures: m.TotalFailures,
		MaxLatency:    m.LatencyMax,
	}
	if m.TotalRequests > 0 {
		snap.SuccessRate = float64(m.TotalSuccess) / float64(m.TotalRequests) * 100
	}
	if m.LatencyCount > 0 {
		snap.AvgLatency = m.LatencySum / time.Duration(m.LatencyCount)
	}
	return snap
}

// log 将本次调用及累计统计打印到标准日志。
func (m *Metrics) log(snap MetricsSnapshot, duration time.Duration, err error) {
	var sb strings.Builder
	if err != nil {
		sb.WriteString(fmt.Sprintf("[LLM] FAIL  latency=%-8s | ", duration.Round(time.Millisecond)))
	} else {
		sb.WriteString(fmt.Sprintf("[LLM] OK    latency=%-8s | ", duration.Round(time.Millisecond)))
	}
	sb.WriteString(fmt.Sprintf(
		"total=%d ok=%d fail=%d success_rate=%.1f%% avg=%s max=%s",
		snap.TotalRequests,
		snap.TotalSuccess,
		snap.TotalFailures,
		snap.SuccessRate,
		snap.AvgLatency.Round(time.Millisecond),
		snap.MaxLatency.Round(time.Millisecond),
	))
	if err != nil {
		sb.WriteString(fmt.Sprintf(" err=%v", err))
	}
	log.Println(sb.String())
}
