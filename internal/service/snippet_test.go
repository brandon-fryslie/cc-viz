package service

import (
	"strings"
	"testing"
)

func TestExtractSnippet_MatchFound(t *testing.T) {
	fullText := "The quick brown fox jumps over the lazy dog. This is a test sentence with more content to verify context extraction."
	query := "fox"
	contextChars := 20

	result := ExtractSnippet(fullText, query, contextChars)

	// Should contain the match
	if !strings.Contains(result.Snippet, "fox") {
		t.Errorf("Expected snippet to contain 'fox', got: %s", result.Snippet)
	}

	// Should have highlighting
	if result.HighlightStart == 0 && result.HighlightEnd == 0 {
		t.Error("Expected non-zero highlight offsets")
	}

	// Verify highlighted text is correct
	highlighted := result.Snippet[result.HighlightStart:result.HighlightEnd]
	if strings.ToLower(highlighted) != "fox" {
		t.Errorf("Expected highlighted text to be 'fox', got: %s", highlighted)
	}

	// Should have context before and after
	if !strings.Contains(result.Snippet, "brown") || !strings.Contains(result.Snippet, "jumps") {
		t.Errorf("Expected context around match, got: %s", result.Snippet)
	}
}

func TestExtractSnippet_CaseInsensitive(t *testing.T) {
	fullText := "Error occurred in the system. ERROR: Critical failure."
	query := "error"
	contextChars := 15

	result := ExtractSnippet(fullText, query, contextChars)

	// Should find first occurrence (case-insensitive)
	if !strings.Contains(strings.ToLower(result.Snippet), "error") {
		t.Errorf("Expected snippet to contain 'error', got: %s", result.Snippet)
	}

	// Should highlight the match
	highlighted := result.Snippet[result.HighlightStart:result.HighlightEnd]
	if strings.ToLower(highlighted) != "error" {
		t.Errorf("Expected highlighted text to be 'Error' (case preserved), got: %s", highlighted)
	}
}

func TestExtractSnippet_MatchNotFound(t *testing.T) {
	fullText := "The quick brown fox jumps over the lazy dog."
	query := "elephant"
	contextChars := 20

	result := ExtractSnippet(fullText, query, contextChars)

	// Should return first N chars
	if result.Snippet == "" {
		t.Error("Expected non-empty snippet when match not found")
	}

	// Should not have highlighting
	if result.HighlightStart != 0 || result.HighlightEnd != 0 {
		t.Errorf("Expected zero highlight offsets when no match, got start=%d end=%d",
			result.HighlightStart, result.HighlightEnd)
	}

	// Should start with beginning of text
	if !strings.HasPrefix(result.Snippet, "The quick") {
		t.Errorf("Expected snippet to start with 'The quick', got: %s", result.Snippet)
	}
}

func TestExtractSnippet_EmptyText(t *testing.T) {
	result := ExtractSnippet("", "query", 20)

	if result.Snippet != "" {
		t.Errorf("Expected empty snippet for empty text, got: %s", result.Snippet)
	}

	if result.HighlightStart != 0 || result.HighlightEnd != 0 {
		t.Error("Expected zero highlight offsets for empty text")
	}
}

func TestExtractSnippet_EmptyQuery(t *testing.T) {
	fullText := "The quick brown fox jumps over the lazy dog."
	result := ExtractSnippet(fullText, "", 20)

	// Should return first N chars without highlighting
	if result.Snippet == "" {
		t.Error("Expected non-empty snippet for empty query")
	}

	if result.HighlightStart != 0 || result.HighlightEnd != 0 {
		t.Error("Expected zero highlight offsets for empty query")
	}

	// Should start with beginning of text
	if !strings.HasPrefix(result.Snippet, "The quick") {
		t.Errorf("Expected snippet to start with 'The quick', got: %s", result.Snippet)
	}
}

func TestExtractSnippet_MultiTermQuery(t *testing.T) {
	fullText := "The quick brown fox jumps over the lazy dog. More content here."
	query := "fox jumps"
	contextChars := 15

	result := ExtractSnippet(fullText, query, contextChars)

	// Should use first term for positioning
	if !strings.Contains(result.Snippet, "fox") {
		t.Errorf("Expected snippet to contain 'fox', got: %s", result.Snippet)
	}

	// Should highlight first term
	highlighted := result.Snippet[result.HighlightStart:result.HighlightEnd]
	if strings.ToLower(highlighted) != "fox" {
		t.Errorf("Expected highlighted text to be 'fox', got: %s", highlighted)
	}
}

func TestExtractSnippet_EllipsisAtStart(t *testing.T) {
	fullText := "A very long prefix that should be truncated. The MATCH is here."
	query := "MATCH"
	contextChars := 10

	result := ExtractSnippet(fullText, query, contextChars)

	// Should have ellipsis at start
	if !strings.HasPrefix(result.Snippet, "...") {
		t.Errorf("Expected snippet to start with '...', got: %s", result.Snippet)
	}

	// Should contain the match
	if !strings.Contains(result.Snippet, "MATCH") {
		t.Errorf("Expected snippet to contain 'MATCH', got: %s", result.Snippet)
	}
}

func TestExtractSnippet_EllipsisAtEnd(t *testing.T) {
	fullText := "The MATCH is near the beginning and there is a very long suffix that should be truncated."
	query := "MATCH"
	contextChars := 10

	result := ExtractSnippet(fullText, query, contextChars)

	// Should have ellipsis at end
	if !strings.HasSuffix(result.Snippet, "...") {
		t.Errorf("Expected snippet to end with '...', got: %s", result.Snippet)
	}

	// Should contain the match
	if !strings.Contains(result.Snippet, "MATCH") {
		t.Errorf("Expected snippet to contain 'MATCH', got: %s", result.Snippet)
	}
}

func TestExtractSnippet_EllipsisAtBoth(t *testing.T) {
	fullText := "A very long prefix. The MATCH is in the middle. A very long suffix."
	query := "MATCH"
	contextChars := 5

	result := ExtractSnippet(fullText, query, contextChars)

	// Should have ellipsis at both ends
	if !strings.HasPrefix(result.Snippet, "...") {
		t.Errorf("Expected snippet to start with '...', got: %s", result.Snippet)
	}
	if !strings.HasSuffix(result.Snippet, "...") {
		t.Errorf("Expected snippet to end with '...', got: %s", result.Snippet)
	}

	// Should contain the match
	if !strings.Contains(result.Snippet, "MATCH") {
		t.Errorf("Expected snippet to contain 'MATCH', got: %s", result.Snippet)
	}
}

func TestExtractSnippet_NoEllipsis(t *testing.T) {
	fullText := "Short text with match."
	query := "match"
	contextChars := 50

	result := ExtractSnippet(fullText, query, contextChars)

	// Should not have ellipsis (entire text fits)
	if strings.HasPrefix(result.Snippet, "...") || strings.HasSuffix(result.Snippet, "...") {
		t.Errorf("Expected no ellipsis for short text, got: %s", result.Snippet)
	}

	// Should be the complete text
	if result.Snippet != fullText {
		t.Errorf("Expected complete text, got: %s", result.Snippet)
	}
}

func TestExtractSnippet_UnicodeHandling(t *testing.T) {
	// Test with multi-byte UTF-8 characters
	fullText := "Hello 世界! This is a test with emoji 🎉 and MATCH here."
	query := "MATCH"
	contextChars := 15

	result := ExtractSnippet(fullText, query, contextChars)

	// Should find the match
	if !strings.Contains(result.Snippet, "MATCH") {
		t.Errorf("Expected snippet to contain 'MATCH', got: %s", result.Snippet)
	}

	// Should have valid highlight offsets
	if result.HighlightStart == 0 && result.HighlightEnd == 0 {
		t.Error("Expected non-zero highlight offsets")
	}

	// Verify highlighted text is correct
	highlighted := result.Snippet[result.HighlightStart:result.HighlightEnd]
	if strings.ToLower(highlighted) != "match" {
		t.Errorf("Expected highlighted text to be 'MATCH', got: %s", highlighted)
	}
}

func TestExtractSnippet_MatchAtStart(t *testing.T) {
	fullText := "MATCH is at the very beginning of this text."
	query := "match"
	contextChars := 15

	result := ExtractSnippet(fullText, query, contextChars)

	// Should not have ellipsis at start
	if strings.HasPrefix(result.Snippet, "...") {
		t.Errorf("Expected no ellipsis at start, got: %s", result.Snippet)
	}

	// Should contain the match
	if !strings.Contains(result.Snippet, "MATCH") {
		t.Errorf("Expected snippet to contain 'MATCH', got: %s", result.Snippet)
	}

	// Should have context after (at least "is at the")
	if !strings.Contains(result.Snippet, "is at the") {
		t.Errorf("Expected context after match, got: %s", result.Snippet)
	}
}

func TestExtractSnippet_MatchAtEnd(t *testing.T) {
	fullText := "This text has the MATCH at the very end"
	query := "end"
	contextChars := 15

	result := ExtractSnippet(fullText, query, contextChars)

	// Should not have ellipsis at end
	if strings.HasSuffix(result.Snippet, "...") && !strings.Contains(result.Snippet, "end") {
		t.Errorf("Expected no ellipsis after match at end, got: %s", result.Snippet)
	}

	// Should contain the match
	if !strings.Contains(result.Snippet, "end") {
		t.Errorf("Expected snippet to contain 'end', got: %s", result.Snippet)
	}
}

func TestExtractSnippet_VeryLongText(t *testing.T) {
	// Create a very long text
	longText := strings.Repeat("This is filler text. ", 100) + "The MATCH is here. " + strings.Repeat("More filler text. ", 100)
	query := "MATCH"
	contextChars := 30

	result := ExtractSnippet(longText, query, contextChars)

	// Should have ellipsis at both ends
	if !strings.HasPrefix(result.Snippet, "...") || !strings.HasSuffix(result.Snippet, "...") {
		t.Errorf("Expected ellipsis at both ends, got: %s", result.Snippet)
	}

	// Should contain the match
	if !strings.Contains(result.Snippet, "MATCH") {
		t.Errorf("Expected snippet to contain 'MATCH', got: %s", result.Snippet)
	}

	// Snippet should be reasonably sized
	snippetRunes := []rune(result.Snippet)
	if len(snippetRunes) > contextChars*3 {
		t.Errorf("Expected snippet to be reasonably sized, got %d runes", len(snippetRunes))
	}
}

func TestExtractSnippet_ZeroContext(t *testing.T) {
	fullText := "The quick brown fox jumps over the lazy dog."
	query := "fox"
	contextChars := 0

	result := ExtractSnippet(fullText, query, contextChars)

	// Should still return something (fallback behavior)
	if result.Snippet == "" {
		t.Error("Expected non-empty snippet even with zero context")
	}
}
