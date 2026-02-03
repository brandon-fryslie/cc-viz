package service

import (
	"strings"
	"unicode/utf8"
)

// SnippetResult contains a text snippet with highlight offsets
type SnippetResult struct {
	Snippet        string `json:"snippet"`
	HighlightStart int    `json:"highlightStart"` // 0-based byte offset in snippet
	HighlightEnd   int    `json:"highlightEnd"`   // 0-based byte offset in snippet
}

// ExtractSnippet extracts a snippet from fullText around the first occurrence of searchQuery
// with contextChars before and after the match. Returns highlight offsets relative to the snippet.
//
// Parameters:
//   - fullText: The full text to extract from
//   - searchQuery: The search query (multi-term queries use first term for positioning)
//   - contextChars: Approximate number of characters to include before and after match
//
// Returns a SnippetResult with:
//   - Snippet: Extracted text with ellipsis at truncation boundaries
//   - HighlightStart: Byte offset where the match starts in the snippet
//   - HighlightEnd: Byte offset where the match ends in the snippet
//
// Edge cases:
//   - If searchQuery is empty: returns first N chars, no highlighting
//   - If fullText is empty: returns empty snippet, no highlighting
//   - If term not found: returns first N chars, no highlighting
func ExtractSnippet(fullText, searchQuery string, contextChars int) SnippetResult {
	// Handle empty inputs
	if fullText == "" {
		return SnippetResult{
			Snippet:        "",
			HighlightStart: 0,
			HighlightEnd:   0,
		}
	}

	if searchQuery == "" || contextChars <= 0 {
		// Return first N chars without highlighting
		maxChars := contextChars * 2
		if maxChars <= 0 {
			maxChars = 200 // Default fallback
		}
		snippet := truncateToChars(fullText, maxChars)
		if len(snippet) < len(fullText) {
			snippet += "..."
		}
		return SnippetResult{
			Snippet:        snippet,
			HighlightStart: 0,
			HighlightEnd:   0,
		}
	}

	// Extract first term from query for positioning
	terms := strings.Fields(searchQuery)
	if len(terms) == 0 {
		// No valid terms, return first N chars
		maxChars := contextChars * 2
		snippet := truncateToChars(fullText, maxChars)
		if len(snippet) < len(fullText) {
			snippet += "..."
		}
		return SnippetResult{
			Snippet:        snippet,
			HighlightStart: 0,
			HighlightEnd:   0,
		}
	}

	searchTerm := terms[0]

	// Find term position (case-insensitive)
	lowerText := strings.ToLower(fullText)
	lowerTerm := strings.ToLower(searchTerm)
	matchPos := strings.Index(lowerText, lowerTerm)

	// If not found, return first N chars without highlighting
	if matchPos == -1 {
		maxChars := contextChars * 2
		snippet := truncateToChars(fullText, maxChars)
		if len(snippet) < len(fullText) {
			snippet += "..."
		}
		return SnippetResult{
			Snippet:        snippet,
			HighlightStart: 0,
			HighlightEnd:   0,
		}
	}

	// Calculate snippet boundaries
	// We need to work with rune offsets for proper Unicode handling,
	// then convert back to byte offsets for the final result

	// Convert byte position to rune position
	matchRunePos := utf8.RuneCountInString(fullText[:matchPos])
	matchRuneLen := utf8.RuneCountInString(searchTerm)

	// Calculate start and end in runes
	totalRunes := utf8.RuneCountInString(fullText)
	startRune := maxInt(0, matchRunePos-contextChars)
	endRune := minInt(totalRunes, matchRunePos+matchRuneLen+contextChars)

	// Extract snippet by rune positions
	runes := []rune(fullText)
	snippetRunes := runes[startRune:endRune]
	snippet := string(snippetRunes)

	// Add ellipsis at boundaries
	prefix := ""
	suffix := ""
	if startRune > 0 {
		prefix = "..."
	}
	if endRune < totalRunes {
		suffix = "..."
	}
	snippet = prefix + snippet + suffix

	// Calculate highlight offsets relative to snippet start
	// highlightStart is after the prefix ellipsis (if any)
	highlightStart := len(prefix) + runeOffsetToByteOffset(string(snippetRunes), matchRunePos-startRune)
	highlightEnd := highlightStart + len(searchTerm)

	return SnippetResult{
		Snippet:        snippet,
		HighlightStart: highlightStart,
		HighlightEnd:   highlightEnd,
	}
}

// truncateToChars truncates text to approximately maxChars characters (runes)
func truncateToChars(text string, maxChars int) string {
	runes := []rune(text)
	if len(runes) <= maxChars {
		return text
	}
	return string(runes[:maxChars])
}

// runeOffsetToByteOffset converts a rune offset to a byte offset in the given text
func runeOffsetToByteOffset(text string, runeOffset int) int {
	if runeOffset <= 0 {
		return 0
	}

	byteOffset := 0
	currentRune := 0
	for currentRune < runeOffset && byteOffset < len(text) {
		_, size := utf8.DecodeRuneInString(text[byteOffset:])
		byteOffset += size
		currentRune++
	}
	return byteOffset
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
