package tts

import (
	"strings"
	"unicode/utf8"
)

// SentenceSplitter 将流式文本拆分成完整的句子。
// 它会累积文本直到遇到断句符号，然后输出一个完整的句子。
// 这样 TTS 可以按句合成，兼顾延迟和自然度。
type SentenceSplitter struct {
	buffer   strings.Builder
	minChars int // 最少积累多少字符才考虑断句
}

// NewSentenceSplitter 创建一个断句器。
// minChars 控制最小句子长度，避免过短的片段导致 TTS 效果差。
func NewSentenceSplitter(minChars int) *SentenceSplitter {
	if minChars <= 0 {
		minChars = 8
	}
	return &SentenceSplitter{minChars: minChars}
}

// 中文断句符号集合
var sentenceEnders = map[rune]bool{
	'。': true, '！': true, '？': true,
	'…': true, '；': true, '\n': true,
	'.': true, '!': true, '?': true,
	';': true,
}

// Feed 向拆分器喂入一段新文本，返回可以发送给 TTS 的完整句子。
// 如果没有达到断句条件，返回空字符串。
func (s *SentenceSplitter) Feed(text string) []string {
	s.buffer.WriteString(text)

	var sentences []string
	content := s.buffer.String()

	for {
		idx := s.findSentenceEnd(content)
		if idx < 0 {
			break
		}

		sentence := strings.TrimSpace(content[:idx+1])
		if sentence != "" {
			sentences = append(sentences, sentence)
		}
		content = content[idx+1:]
	}

	s.buffer.Reset()
	s.buffer.WriteString(content)

	return sentences
}

// Flush 返回缓冲区中剩余的所有文本（作为最后一个句子）。
func (s *SentenceSplitter) Flush() string {
	remaining := strings.TrimSpace(s.buffer.String())
	s.buffer.Reset()
	return remaining
}

// findSentenceEnd 在文本中找到第一个满足断句条件的位置。
// 返回断句符号的字节偏移量，找不到返回 -1。
func (s *SentenceSplitter) findSentenceEnd(text string) int {
	charCount := 0
	for i, r := range text {
		charCount++
		if sentenceEnders[r] && charCount >= s.minChars {
			// 处理省略号（连续的 …）
			if r == '…' {
				// 跳过后续的 …
				rest := text[i:]
				endPos := i
				for j, rr := range rest {
					if j == 0 {
						continue
					}
					if rr == '…' {
						endPos = i + j
					} else {
						break
					}
				}
				return endPos
			}
			return i + utf8.RuneLen(r) - 1
		}
	}
	return -1
}
