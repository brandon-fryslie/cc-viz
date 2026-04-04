package parser

import (
	"bufio"
	"encoding/json"
	"os"
	"sort"
	"time"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/rollup"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/source"
)

type Result struct {
	LineCount    int
	SkippedLines int
	RequestCount int
}

type envelope struct {
	SessionID string          `json:"sessionId"`
	RequestID string          `json:"requestId"`
	UUID      string          `json:"uuid"`
	Timestamp string          `json:"timestamp"`
	Message   json.RawMessage `json:"message"`
}

type message struct {
	Role  string `json:"role"`
	Model string `json:"model"`
	Usage *usage `json:"usage"`
}

type usage struct {
	InputTokens              int64 `json:"input_tokens"`
	OutputTokens             int64 `json:"output_tokens"`
	CacheReadInputTokens     int64 `json:"cache_read_input_tokens"`
	CacheCreationInputTokens int64 `json:"cache_creation_input_tokens"`
}

func ParseFile(file source.FileRecord) ([]rollup.RequestUsage, Result, error) {
	handle, err := os.Open(file.Path)
	if err != nil {
		return nil, Result{}, err
	}
	defer handle.Close()

	scanner := bufio.NewScanner(handle)
	const maxScanTokenSize = 64 * 1024 * 1024
	scanner.Buffer(make([]byte, 64*1024), maxScanTokenSize)

	requests := make(map[string]*rollup.RequestUsage)
	result := Result{}

	for scanner.Scan() {
		result.LineCount++
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var env envelope
		if err := json.Unmarshal(line, &env); err != nil {
			result.SkippedLines++
			continue
		}

		timestamp, ok := parseTimestamp(env.Timestamp)
		if !ok {
			result.SkippedLines++
			continue
		}

		var msg message
		if err := json.Unmarshal(env.Message, &msg); err != nil {
			result.SkippedLines++
			continue
		}

		if msg.Usage == nil || (msg.Role != "user" && msg.Role != "assistant") {
			continue
		}

		requestKey := env.RequestID
		if requestKey == "" {
			requestKey = env.UUID
		}
		if requestKey == "" {
			result.SkippedLines++
			continue
		}

		entry, exists := requests[requestKey]
		if !exists {
			sessionID := env.SessionID
			if sessionID == "" {
				sessionID = file.SessionID
			}
			entry = &rollup.RequestUsage{
				SourcePath:   file.Path,
				SessionID:    sessionID,
				Project:      file.Project,
				RequestKey:   requestKey,
				Model:        defaultModel(msg.Model),
				FirstSeenAt:  timestamp.UTC(),
				HourStartUTC: rollup.HourStartUTC(timestamp),
			}
			requests[requestKey] = entry
		}

		if timestamp.UTC().Before(entry.FirstSeenAt) {
			entry.FirstSeenAt = timestamp.UTC()
			entry.HourStartUTC = rollup.HourStartUTC(timestamp)
		}

		if msg.Model > entry.Model {
			entry.Model = msg.Model
		}

		if msg.Usage.InputTokens > entry.InputTokens {
			entry.InputTokens = msg.Usage.InputTokens
		}
		if msg.Usage.OutputTokens > entry.OutputTokens {
			entry.OutputTokens = msg.Usage.OutputTokens
		}
		if msg.Usage.CacheReadInputTokens > entry.CacheReadTokens {
			entry.CacheReadTokens = msg.Usage.CacheReadInputTokens
		}
		if msg.Usage.CacheCreationInputTokens > entry.CacheCreationTokens {
			entry.CacheCreationTokens = msg.Usage.CacheCreationInputTokens
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, result, err
	}

	parsed := make([]rollup.RequestUsage, 0, len(requests))
	for _, request := range requests {
		if request.Model == "" {
			request.Model = "unknown"
		}
		parsed = append(parsed, *request)
	}

	sort.Slice(parsed, func(i, j int) bool {
		if parsed[i].HourStartUTC.Equal(parsed[j].HourStartUTC) {
			return parsed[i].RequestKey < parsed[j].RequestKey
		}
		return parsed[i].HourStartUTC.Before(parsed[j].HourStartUTC)
	})

	result.RequestCount = len(parsed)
	return parsed, result, nil
}

func parseTimestamp(value string) (time.Time, bool) {
	layouts := []string{time.RFC3339Nano, time.RFC3339}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UTC(), true
		}
	}
	return time.Time{}, false
}

func defaultModel(model string) string {
	if model == "" {
		return "unknown"
	}
	return model
}
