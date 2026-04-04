package parser

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/source"
)

func TestParseFile_DeduplicatesAndSkipsMalformedLines(t *testing.T) {
	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "session-1.jsonl")
	content := `{"sessionId":"session-1","requestId":"req-1","uuid":"msg-1","timestamp":"2026-04-03T10:15:00Z","message":{"role":"assistant","model":"claude-sonnet","usage":{"input_tokens":10,"output_tokens":20,"cache_read_input_tokens":30,"cache_creation_input_tokens":40}}}
not-json
{"sessionId":"session-1","requestId":"req-1","uuid":"msg-2","timestamp":"2026-04-03T10:16:00Z","message":{"role":"assistant","model":"claude-sonnet","usage":{"input_tokens":8,"output_tokens":25,"cache_read_input_tokens":10,"cache_creation_input_tokens":2}}}
{"sessionId":"session-1","uuid":"msg-3","timestamp":"2026-04-03T10:25:00Z","message":{"role":"user","model":"claude-haiku","usage":{"input_tokens":2,"output_tokens":3,"cache_read_input_tokens":4,"cache_creation_input_tokens":5}}}
{"sessionId":"session-1","uuid":"msg-4","timestamp":"2026-04-03T10:26:00Z","message":{"role":"assistant","model":"claude-haiku"}}
`
	if err := os.WriteFile(filePath, []byte(content), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	usages, result, err := ParseFile(source.FileRecord{
		Path:      filePath,
		Project:   "project-a",
		SessionID: "session-1",
	})
	if err != nil {
		t.Fatalf("ParseFile() error = %v", err)
	}

	if result.SkippedLines != 1 {
		t.Fatalf("SkippedLines = %d, want 1", result.SkippedLines)
	}
	if len(usages) != 2 {
		t.Fatalf("len(usages) = %d, want 2", len(usages))
	}

	byKey := make(map[string]struct {
		input  int64
		output int64
		read   int64
		create int64
	})
	for _, usage := range usages {
		byKey[usage.RequestKey] = struct {
			input  int64
			output int64
			read   int64
			create int64
		}{
			input:  usage.InputTokens,
			output: usage.OutputTokens,
			read:   usage.CacheReadTokens,
			create: usage.CacheCreationTokens,
		}
	}

	if request, ok := byKey["req-1"]; !ok {
		t.Fatalf("missing req-1 usage row: %+v", usages)
	} else if request.input != 10 || request.output != 25 || request.read != 30 || request.create != 40 {
		t.Fatalf("unexpected req-1 values: %+v", request)
	}

	if _, ok := byKey["msg-3"]; !ok {
		t.Fatalf("missing msg-3 usage row: %+v", usages)
	}
}
