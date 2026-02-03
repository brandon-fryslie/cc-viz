package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/brandon-fryslie/cc-viz/internal/model"
)

// QueueWatcher watches a queue directory for HAR files, ingests them to the database,
// and deletes them after successful processing. It uses fsnotify for efficient file
// system watching and processes files in timestamp order.
//
// Supported file formats:
// - .har files (HAR 1.2 format) with optional .meta.json companion files
type QueueWatcher struct {
	queueDir      string
	deadLetterDir string
	storage       *SQLiteStorageService
	logger        *log.Logger
	watcher       *fsnotify.Watcher
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	processMu     sync.Mutex
}

// NewQueueWatcher creates a new queue watcher that monitors the specified directory
// and ingests files to the storage service.
func NewQueueWatcher(queueDir, deadLetterDir string, storage *SQLiteStorageService, logger *log.Logger) (*QueueWatcher, error) {
	// Create queue directory if it doesn't exist
	if err := os.MkdirAll(queueDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create queue directory: %w", err)
	}

	// Create dead letter directory if it doesn't exist
	if err := os.MkdirAll(deadLetterDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create dead letter directory: %w", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create fsnotify watcher: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &QueueWatcher{
		queueDir:      queueDir,
		deadLetterDir: deadLetterDir,
		storage:       storage,
		logger:        logger,
		watcher:       watcher,
		ctx:           ctx,
		cancel:        cancel,
	}, nil
}

// Start begins watching the queue directory and processing files.
// It first processes any existing files (startup catch-up), then watches for new files.
func (qw *QueueWatcher) Start() error {
	// Add queue directory to watcher
	if err := qw.watcher.Add(qw.queueDir); err != nil {
		return fmt.Errorf("failed to watch queue directory: %w", err)
	}

	qw.logger.Printf("Queue watcher started, monitoring: %s", qw.queueDir)

	// Process existing files at startup (catch-up)
	if err := qw.processExistingFiles(); err != nil {
		qw.logger.Printf("Warning: error processing existing files: %v", err)
	}

	// Start watch loop in goroutine
	qw.wg.Add(1)
	go qw.watchLoop()

	return nil
}

// Stop gracefully shuts down the queue watcher
func (qw *QueueWatcher) Stop() error {
	qw.logger.Println("Stopping queue watcher...")
	qw.cancel()
	qw.watcher.Close()
	qw.wg.Wait()
	qw.logger.Println("Queue watcher stopped")
	return nil
}

// watchLoop is the main event loop that processes file system events
func (qw *QueueWatcher) watchLoop() {
	defer qw.wg.Done()

	for {
		select {
		case <-qw.ctx.Done():
			return

		case event, ok := <-qw.watcher.Events:
			if !ok {
				return
			}

			// Only process Create and Write events for .har files
			if event.Op&(fsnotify.Create|fsnotify.Write) != 0 {
				filename := event.Name
				// Skip temp files and metadata files (they're processed with their HAR)
				if strings.HasSuffix(filename, ".tmp") || strings.HasSuffix(filename, ".meta.json") {
					continue
				}

				if strings.HasSuffix(filename, ".har") {
					// Small delay to ensure file is fully written
					time.Sleep(50 * time.Millisecond)
					if err := qw.processFile(filename); err != nil {
						qw.logger.Printf("Error processing file %s: %v", filename, err)
					}
				}
			}

		case err, ok := <-qw.watcher.Errors:
			if !ok {
				return
			}
			qw.logger.Printf("Watcher error: %v", err)
		}
	}
}

// processExistingFiles processes all .har files in the queue directory at startup
func (qw *QueueWatcher) processExistingFiles() error {
	entries, err := os.ReadDir(qw.queueDir)
	if err != nil {
		return fmt.Errorf("failed to read queue directory: %w", err)
	}

	// Collect .har files (excluding .tmp and .meta.json files)
	var files []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".tmp") || strings.HasSuffix(name, ".meta.json") {
			continue
		}
		if strings.HasSuffix(name, ".har") {
			files = append(files, filepath.Join(qw.queueDir, name))
		}
	}

	// Sort files by name (which includes timestamp) for ordering
	sort.Strings(files)

	qw.logger.Printf("Processing %d existing files from queue", len(files))

	// Process each file
	for _, filePath := range files {
		if err := qw.processFile(filePath); err != nil {
			qw.logger.Printf("Error processing file %s: %v", filePath, err)
		}
	}

	return nil
}

// processFile reads a HAR file, ingests it to the database, and deletes it
func (qw *QueueWatcher) processFile(filePath string) error {
	// Use mutex to ensure files are processed serially (in order)
	qw.processMu.Lock()
	defer qw.processMu.Unlock()

	qw.logger.Printf("Processing queue file: %s", filepath.Base(filePath))

	requestLog, err := qw.processHARFile(filePath)
	if err != nil {
		return err
	}

	// Save to database
	if _, err := qw.storage.SaveRequest(requestLog); err != nil {
		// Don't move to dead letter - this might be a transient DB error
		return fmt.Errorf("failed to save to database: %w", err)
	}

	// Update with response if present
	if requestLog.Response != nil {
		if err := qw.storage.UpdateRequestWithResponse(requestLog); err != nil {
			qw.logger.Printf("Warning: failed to update request with response: %v", err)
		}
	}

	// Delete file(s) after successful ingestion
	if err := os.Remove(filePath); err != nil {
		qw.logger.Printf("Warning: failed to delete processed file %s: %v", filePath, err)
	}

	// Also delete companion .meta.json
	metaPath := strings.TrimSuffix(filePath, ".har") + ".meta.json"
	if _, err := os.Stat(metaPath); err == nil {
		if err := os.Remove(metaPath); err != nil {
			qw.logger.Printf("Warning: failed to delete metadata file %s: %v", metaPath, err)
		}
	}

	qw.logger.Printf("Successfully processed and deleted: %s", filepath.Base(filePath))
	return nil
}

// processHARFile processes a HAR format file with optional metadata
func (qw *QueueWatcher) processHARFile(filePath string) (*model.RequestLog, error) {
	// Read HAR file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read HAR file: %w", err)
	}

	// Parse HAR
	var har HAR
	if err := json.Unmarshal(data, &har); err != nil {
		qw.moveToDeadLetter(filePath, fmt.Sprintf("invalid HAR JSON: %v", err))
		return nil, fmt.Errorf("failed to parse HAR: %w", err)
	}

	// Validate HAR structure
	if len(har.Log.Entries) == 0 {
		qw.moveToDeadLetter(filePath, "HAR contains no entries")
		return nil, fmt.Errorf("HAR contains no entries")
	}

	// Try to read companion metadata file
	metaPath := strings.TrimSuffix(filePath, ".har") + ".meta.json"
	var metadata *ProxyMetadata
	if metaData, err := os.ReadFile(metaPath); err == nil {
		var meta ProxyMetadata
		if err := json.Unmarshal(metaData, &meta); err == nil {
			metadata = &meta
		} else {
			qw.logger.Printf("Warning: failed to parse metadata file %s: %v", metaPath, err)
		}
	}

	// Convert HAR entry to RequestLog
	return qw.harEntryToRequestLog(&har.Log.Entries[0], metadata)
}

// moveToDeadLetter moves a malformed file to the dead letter directory
func (qw *QueueWatcher) moveToDeadLetter(filePath, reason string) {
	filename := filepath.Base(filePath)
	deadLetterPath := filepath.Join(qw.deadLetterDir, filename)

	// Create error file with reason
	errorPath := deadLetterPath + ".error"
	errorContent := fmt.Sprintf("File: %s\nReason: %s\nTimestamp: %s\n", filename, reason, time.Now().Format(time.RFC3339))
	if err := os.WriteFile(errorPath, []byte(errorContent), 0644); err != nil {
		qw.logger.Printf("Warning: failed to write error file: %v", err)
	}

	// Move file to dead letter
	if err := os.Rename(filePath, deadLetterPath); err != nil {
		qw.logger.Printf("Warning: failed to move file to dead letter: %v", err)
		// Try to delete instead
		if err := os.Remove(filePath); err != nil {
			qw.logger.Printf("Warning: failed to delete malformed file: %v", err)
		}
	} else {
		qw.logger.Printf("Moved malformed file to dead letter: %s (reason: %s)", filename, reason)
	}
}

// harEntryToRequestLog converts a HAR entry to a RequestLog
func (qw *QueueWatcher) harEntryToRequestLog(entry *HAREntry, metadata *ProxyMetadata) (*model.RequestLog, error) {
	// Parse timestamp
	timestamp := entry.StartedDateTime

	// Generate request ID from metadata or HAR custom field
	requestID := entry.ProxyRequestID
	if metadata != nil && metadata.RequestID != "" {
		requestID = metadata.RequestID
	}
	if requestID == "" {
		// Generate a unique ID from timestamp
		requestID = fmt.Sprintf("har-%d", time.Now().UnixNano())
	}

	// Extract endpoint from URL
	endpoint := entry.Request.URL

	// Build headers map from HAR headers
	requestHeaders := make(map[string][]string)
	for _, h := range entry.Request.Headers {
		requestHeaders[h.Name] = append(requestHeaders[h.Name], h.Value)
	}

	responseHeaders := make(map[string][]string)
	for _, h := range entry.Response.Headers {
		responseHeaders[h.Name] = append(responseHeaders[h.Name], h.Value)
	}

	// Parse request body
	var requestBody interface{}
	if entry.Request.PostData != nil && entry.Request.PostData.Text != "" {
		if err := json.Unmarshal([]byte(entry.Request.PostData.Text), &requestBody); err != nil {
			// Not JSON, store as string
			requestBody = entry.Request.PostData.Text
		}
	}

	// Get content type
	var contentType string
	if entry.Request.PostData != nil {
		contentType = entry.Request.PostData.MimeType
	}

	// Build RequestLog
	requestLog := &model.RequestLog{
		RequestID:   requestID,
		Timestamp:   timestamp,
		Endpoint:    endpoint,
		Method:      entry.Request.Method,
		Headers:     requestHeaders,
		Body:        requestBody,
		ContentType: contentType,
	}

	// Add metadata if present
	if metadata != nil {
		requestLog.Provider = metadata.Provider
		requestLog.Model = metadata.ActualModel
		requestLog.OriginalModel = metadata.ActualModel
		requestLog.RoutedModel = metadata.TargetModel
		requestLog.SubagentName = metadata.SubagentName
		requestLog.ToolsUsed = metadata.ToolsUsed
	}

	// Extract model from request body if not in metadata
	if requestLog.Model == "" && requestBody != nil {
		if bodyMap, ok := requestBody.(map[string]interface{}); ok {
			if modelVal, ok := bodyMap["model"].(string); ok {
				requestLog.Model = modelVal
				requestLog.OriginalModel = modelVal
				requestLog.RoutedModel = modelVal
			}
		}
	}

	// Build response if present
	if entry.Response.Status != 0 {
		durationMs := int64(entry.Time)
		waitMs := int64(entry.Timings.Wait)
		if waitMs < 0 {
			waitMs = 0
		}

		responseLog := &model.ResponseLog{
			StatusCode:    entry.Response.Status,
			Headers:       responseHeaders,
			ResponseTime:  durationMs,
			FirstByteTime: waitMs,
			IsStreaming:   false,
			CompletedAt:   timestamp,
		}

		// Parse response body
		if entry.Response.Content.Text != "" {
			responseLog.Body = json.RawMessage(entry.Response.Content.Text)

			// Count tool calls from response
			var anthropicResp model.AnthropicResponse
			if err := json.Unmarshal([]byte(entry.Response.Content.Text), &anthropicResp); err == nil {
				toolCallCount := 0
				for _, block := range anthropicResp.Content {
					if block.Type == "tool_use" {
						toolCallCount++
					}
				}
				responseLog.ToolCallCount = toolCallCount
			}
		}

		requestLog.Response = responseLog
	}

	return requestLog, nil
}
