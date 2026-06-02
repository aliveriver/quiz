// Package tts wraps MiniMax WebSocket text-to-speech.
package tts

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Config contains the options needed to create a MiniMax TTS client.
type Config struct {
	WSURL        string
	APIKey       string
	Model        string
	Voice        string
	Speed        float64
	Vol          float64
	Pitch        int
	Format       string
	SampleRate   int
	Bitrate      int
	StartTimeout time.Duration
}

// Client wraps MiniMax WebSocket TTS communication.
type Client struct {
	cfg Config
}

// NewClient creates a TTS client with conservative defaults.
func NewClient(cfg Config) *Client {
	if cfg.WSURL == "" {
		cfg.WSURL = "wss://api.minimaxi.com/ws/v1/t2a_v2"
	}
	if cfg.Model == "" {
		cfg.Model = "speech-02-hd"
	}
	if cfg.Speed == 0 {
		cfg.Speed = 1.0
	}
	if cfg.Vol == 0 {
		cfg.Vol = 1.0
	}
	if cfg.Format == "" {
		cfg.Format = "mp3"
	}
	if cfg.SampleRate == 0 {
		cfg.SampleRate = 32000
	}
	if cfg.Bitrate == 0 {
		cfg.Bitrate = 128000
	}
	if cfg.StartTimeout == 0 {
		cfg.StartTimeout = 15 * time.Second
	}
	return &Client{cfg: cfg}
}

type taskStartEvent struct {
	Event         string       `json:"event"`
	Model         string       `json:"model"`
	LanguageBoost string       `json:"language_boost,omitempty"`
	VoiceSetting  voiceSetting `json:"voice_setting"`
	AudioSetting  audioSetting `json:"audio_setting"`
}

type voiceSetting struct {
	VoiceID string  `json:"voice_id"`
	Speed   float64 `json:"speed"`
	Vol     float64 `json:"vol"`
	Pitch   int     `json:"pitch"`
}

type audioSetting struct {
	SampleRate int    `json:"sample_rate"`
	Bitrate    int    `json:"bitrate"`
	Format     string `json:"format"`
	Channel    int    `json:"channel"`
}

type taskContinueEvent struct {
	Event string `json:"event"`
	Text  string `json:"text"`
}

type taskFinishEvent struct {
	Event string `json:"event"`
}

// ServerEvent is the generic event returned by MiniMax.
type ServerEvent struct {
	SessionID string     `json:"session_id,omitempty"`
	Event     string     `json:"event,omitempty"`
	TraceID   string     `json:"trace_id,omitempty"`
	Data      *AudioData `json:"data,omitempty"`
	IsFinal   bool       `json:"is_final,omitempty"`
	BaseResp  BaseResp   `json:"base_resp,omitempty"`
}

// AudioData contains hex-encoded audio bytes.
type AudioData struct {
	Audio string `json:"audio"`
}

// BaseResp contains MiniMax status information.
type BaseResp struct {
	StatusCode int    `json:"status_code"`
	StatusMsg  string `json:"status_msg"`
}

// Session represents one streaming TTS session.
type Session struct {
	conn    *websocket.Conn
	onAudio func(audioBytes []byte, isFinal bool)
	onError func(err error)
	done    chan struct{}

	mu sync.Mutex

	startCh   chan struct{}
	startOnce sync.Once
	startMu   sync.Mutex
	startErr  error
}

// NewSession connects to MiniMax, sends task_start, and waits for task_started.
func (c *Client) NewSession(onAudio func(audioBytes []byte, isFinal bool), onError func(err error)) (*Session, error) {
	if c.cfg.APIKey == "" {
		return nil, fmt.Errorf("tts: api key is required")
	}

	header := http.Header{}
	header.Set("Authorization", "Bearer "+c.cfg.APIKey)

	conn, _, err := websocket.DefaultDialer.Dial(c.cfg.WSURL, header)
	if err != nil {
		return nil, fmt.Errorf("tts: websocket dial: %w", err)
	}

	s := &Session{
		conn:    conn,
		onAudio: onAudio,
		onError: onError,
		done:    make(chan struct{}),
		startCh: make(chan struct{}),
	}

	go s.readLoop()

	startEvt := taskStartEvent{
		Event:         "task_start",
		Model:         c.cfg.Model,
		LanguageBoost: "Chinese",
		VoiceSetting: voiceSetting{
			VoiceID: c.cfg.Voice,
			Speed:   c.cfg.Speed,
			Vol:     c.cfg.Vol,
			Pitch:   c.cfg.Pitch,
		},
		AudioSetting: audioSetting{
			SampleRate: c.cfg.SampleRate,
			Bitrate:    c.cfg.Bitrate,
			Format:     c.cfg.Format,
			Channel:    1,
		},
	}

	if err := s.writeJSON(startEvt); err != nil {
		conn.Close()
		return nil, fmt.Errorf("tts: send task_start: %w", err)
	}

	select {
	case <-s.startCh:
		if err := s.getStartErr(); err != nil {
			conn.Close()
			return nil, err
		}
	case <-time.After(c.cfg.StartTimeout):
		conn.Close()
		return nil, fmt.Errorf("tts: waiting for task_started timed out after %s", c.cfg.StartTimeout)
	}

	return s, nil
}

// SendText sends one text fragment to the active TTS session.
func (s *Session) SendText(text string) error {
	if text == "" {
		return nil
	}
	return s.writeJSON(taskContinueEvent{
		Event: "task_continue",
		Text:  text,
	})
}

// Finish tells MiniMax that all text has been sent.
func (s *Session) Finish() error {
	return s.writeJSON(taskFinishEvent{Event: "task_finish"})
}

// Done is closed after the WebSocket reader exits.
func (s *Session) Done() <-chan struct{} {
	return s.done
}

// Close closes the underlying WebSocket connection.
func (s *Session) Close() {
	_ = s.conn.Close()
}

func (s *Session) writeJSON(v interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.WriteJSON(v)
}

func (s *Session) getStartErr() error {
	s.startMu.Lock()
	defer s.startMu.Unlock()
	return s.startErr
}

func (s *Session) markStarted(err error) {
	s.startOnce.Do(func() {
		s.startMu.Lock()
		s.startErr = err
		s.startMu.Unlock()
		close(s.startCh)
	})
}

func (s *Session) readLoop() {
	defer close(s.done)
	defer s.conn.Close()

	for {
		_, message, err := s.conn.ReadMessage()
		if err != nil {
			readErr := fmt.Errorf("tts: read message: %w", err)
			s.markStarted(readErr)
			if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) && s.onError != nil {
				s.onError(readErr)
			}
			return
		}

		var evt ServerEvent
		if err := json.Unmarshal(message, &evt); err != nil {
			log.Printf("[TTS] failed to parse server event: %v", err)
			continue
		}

		if evt.Data != nil && evt.Data.Audio != "" {
			audioBytes, err := hex.DecodeString(evt.Data.Audio)
			if err != nil {
				log.Printf("[TTS] failed to decode audio hex: %v", err)
			} else if s.onAudio != nil {
				s.onAudio(audioBytes, evt.IsFinal)
			}
		}

		switch evt.Event {
		case "connected_success":
			log.Printf("[TTS] connected, session=%s", evt.SessionID)
		case "task_started":
			log.Printf("[TTS] task started, session=%s", evt.SessionID)
			s.markStarted(nil)
		case "task_failed":
			err := fmt.Errorf("tts: task_failed: %s (code=%d)", evt.BaseResp.StatusMsg, evt.BaseResp.StatusCode)
			log.Print(err)
			s.markStarted(err)
			if s.onError != nil {
				s.onError(err)
			}
			return
		case "task_finished":
			log.Printf("[TTS] task finished, session=%s", evt.SessionID)
			return
		}
	}
}
