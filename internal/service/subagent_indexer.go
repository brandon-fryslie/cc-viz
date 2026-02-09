package service

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// SubagentIndexer manages the indexing of Claude Code subagent hierarchies
type SubagentIndexer struct {
	storage        *SQLiteStorageService
	watcher        *fsnotify.Watcher
	indexQueue     chan string
	debounceTimers map[string]*time.Timer
	mu             sync.Mutex
	done           chan struct{}
	claudeProjects string
}

// SubagentMessage represents a single message from a subagent JSONL file
type SubagentMessage struct {
	SessionID   string  `json:"sessionId"`
	AgentID     string  `json:"agentId"`
	UUID        string  `json:"uuid"`
	ParentUUID  *string `json:"parentUuid"`
	Timestamp   string  `json:"timestamp"`
	Type        string  `json:"type"`
	IsSidechain bool    `json:"isSidechain"`
}

// NewSubagentIndexer creates a new subagent indexer
func NewSubagentIndexer(storage *SQLiteStorageService) (*SubagentIndexer, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create file watcher: %w", err)
	}

	return &SubagentIndexer{
		storage:        storage,
		watcher:        watcher,
		indexQueue:     make(chan string, 100),
		debounceTimers: make(map[string]*time.Timer),
		done:           make(chan struct{}),
		claudeProjects: filepath.Join(homeDir, ".claude", "projects"),
	}, nil
}

// Start begins the indexing service
func (si *SubagentIndexer) Start() error {
	log.Println("🔍 Starting subagent indexer...")

	go si.processIndexQueue()
	go si.watchFiles()

	go func() {
		if err := si.initialIndex(); err != nil {
			log.Printf("❌ Initial subagent indexing failed: %v", err)
		}
	}()

	return nil
}

// Stop cleanly shuts down the indexer
func (si *SubagentIndexer) Stop() {
	log.Println("🛑 Stopping subagent indexer...")
	close(si.done)
	si.watcher.Close()
	close(si.indexQueue)
}

// initialIndex walks the Claude projects directory and indexes all subagent files
func (si *SubagentIndexer) initialIndex() error {
	startTime := time.Now()
	log.Printf("📂 Starting initial subagent indexing of %s", si.claudeProjects)

	var fileCount, indexedCount int

	err := filepath.Walk(si.claudeProjects, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("⚠️ Error accessing %s: %v", path, err)
			return nil
		}

		// Only process files in subagents/ directories
		if !strings.Contains(path, "/subagents/") {
			return nil
		}

		// Only process agent-*.jsonl files
		if !strings.HasPrefix(filepath.Base(path), "agent-") || !strings.HasSuffix(path, ".jsonl") {
			return nil
		}

		fileCount++

		needsIndex, err := si.needsIndexing(path, info.ModTime())
		if err != nil {
			log.Printf("⚠️ Error checking if %s needs indexing: %v", path, err)
			return nil
		}

		if needsIndex {
			if err := si.indexFile(path); err != nil {
				log.Printf("⚠️ Error indexing %s: %v", path, err)
			} else {
				indexedCount++
			}
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to walk Claude projects: %w", err)
	}

	duration := time.Since(startTime)
	log.Printf("✅ Subagent indexing complete: %d/%d files indexed in %v", indexedCount, fileCount, duration)

	return nil
}

// needsIndexing checks if a file needs to be indexed based on modification time
func (si *SubagentIndexer) needsIndexing(filePath string, mtime time.Time) (bool, error) {
	query := "SELECT file_mtime FROM subagent_graph WHERE file_path = ? LIMIT 1"
	var lastMtime sql.NullString

	err := si.storage.db.QueryRow(query, filePath).Scan(&lastMtime)
	if err == sql.ErrNoRows {
		return true, nil // File not indexed yet
	}
	if err != nil {
		return false, err
	}

	if !lastMtime.Valid {
		return true, nil
	}

	indexedTime, err := time.Parse(time.RFC3339, lastMtime.String)
	if err != nil {
		return true, nil // If we can't parse, re-index
	}

	return mtime.After(indexedTime), nil
}

// indexFile indexes a single subagent JSONL file
func (si *SubagentIndexer) indexFile(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var messages []SubagentMessage
	scanner := bufio.NewScanner(file)
	// Increase buffer for large messages (some lines can exceed 10MB)
	const maxScanTokenSize = 64 * 1024 * 1024 // 64MB
	buf := make([]byte, 64*1024)              // Start with 64KB, grows as needed
	scanner.Buffer(buf, maxScanTokenSize)

	for scanner.Scan() {
		var msg SubagentMessage
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			log.Printf("⚠️ Error parsing line in %s: %v", filePath, err)
			continue
		}
		messages = append(messages, msg)
	}

	if len(messages) == 0 {
		log.Printf("⚠️ Empty subagent file: %s", filePath)
		return nil // Skip empty files
	}

	// Extract metadata from messages
	firstMsg := messages[0]
	lastMsg := messages[len(messages)-1]

	sessionID := firstMsg.SessionID
	agentID := firstMsg.AgentID
	isSidechain := firstMsg.IsSidechain
	messageCount := len(messages)

	// Parse timestamps
	spawnTime, _ := time.Parse(time.RFC3339, firstMsg.Timestamp)
	endTime, _ := time.Parse(time.RFC3339, lastMsg.Timestamp)

	// Find parent agent by scanning the parent session JSONL
	parentAgentID, err := si.findParentAgentID(agentID, filePath)
	if err != nil {
		log.Printf("⚠️ Error finding parent for %s: %v", filePath, err)
		// Continue with NULL parent
	}

	// Get file modification time
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	}

	// Upsert into subagent_graph
	_, err = si.storage.db.Exec(`
		INSERT OR REPLACE INTO subagent_graph (
			session_id, parent_agent_id, agent_id,
			first_message_uuid, last_message_uuid, message_count,
			spawn_time, end_time, status, is_sidechain,
			file_path, file_mtime, indexed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		sessionID,
		parentAgentID, // Can be nil
		agentID,
		firstMsg.UUID,
		lastMsg.UUID,
		messageCount,
		spawnTime.Format(time.RFC3339),
		endTime.Format(time.RFC3339),
		"completed", // Assume completed if file exists
		isSidechain,
		filePath,
		fileInfo.ModTime().Format(time.RFC3339),
		time.Now().Format(time.RFC3339),
	)

	if err != nil {
		return fmt.Errorf("failed to insert subagent graph node: %w", err)
	}

	return nil
}

// searchFileForParent scans a JSONL file for a line containing "agentId: {targetID}"
// and returns the outer agentId field (the spawning agent). Returns nil if not found
// or if the spawning agent is the root session (empty agentId).
func (si *SubagentIndexer) searchFileForParent(filePath, targetID string) (*string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	needle := "agentId: " + targetID

	scanner := bufio.NewScanner(file)
	const maxScanTokenSize = 64 * 1024 * 1024
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, maxScanTokenSize)

	for scanner.Scan() {
		line := scanner.Bytes()
		// Fast text check before JSON parsing — skip lines that can't match.
		if !strings.Contains(string(line), needle) {
			continue
		}

		// Parse to extract the outer agentId field (the spawning agent).
		var envelope struct {
			AgentID string `json:"agentId"`
		}
		if err := json.Unmarshal(line, &envelope); err != nil {
			continue
		}

		// Empty agentId means root session → return nil (no parent agent).
		if envelope.AgentID == "" {
			return nil, nil
		}

		// Non-empty agentId means a nested agent spawned this one.
		parentID := envelope.AgentID
		return &parentID, nil
	}

	// Not found in this file.
	return nil, nil
}

// findParentAgentID determines which agent spawned agentID by scanning the
// parent JSONL file and sibling subagent files. When any agent calls the Task tool,
// the tool_result content contains "agentId: {spawned_id}". The outer "agentId" JSON
// field on that line identifies the spawning (parent) agent.
//
// File layout:
//
//	{session-id}.jsonl                  ← root session
//	{session-id}/subagents/agent-{id}.jsonl
//
// Returns nil when the parent is the root session (agentId "" or not found).
func (si *SubagentIndexer) findParentAgentID(agentID string, filePath string) (*string, error) {
	// [LAW:dataflow-not-control-flow] Early return for compact agents - they're auto-generated, no parent
	if strings.Contains(agentID, "compact") {
		return nil, nil
	}

	// Derive parent JSONL: filePath → …/{session}/subagents/agent-X.jsonl
	// We need …/{session}.jsonl
	subagentsDir := filepath.Dir(filePath)             // …/{session}/subagents
	sessionDir := filepath.Dir(subagentsDir)           // …/{session}
	sessionID := filepath.Base(sessionDir)             // {session-id}
	parentJSONL := filepath.Join(filepath.Dir(sessionDir), sessionID+".jsonl")

	// Phase 1: Search parent session JSONL
	if parentID, err := si.searchFileForParent(parentJSONL, agentID); err == nil && parentID != nil {
		return parentID, nil
	}

	// Phase 2: If not found in root session, scan sibling subagent files
	// The parent might be another subagent in the same session
	entries, err := os.ReadDir(subagentsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read subagents directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		siblingPath := filepath.Join(subagentsDir, entry.Name())
		// Skip self
		if siblingPath == filePath {
			continue
		}

		// Only scan agent-*.jsonl files
		if !strings.HasPrefix(entry.Name(), "agent-") || !strings.HasSuffix(entry.Name(), ".jsonl") {
			continue
		}

		if parentID, err := si.searchFileForParent(siblingPath, agentID); err == nil && parentID != nil {
			return parentID, nil
		}
	}

	// Not found in parent or siblings — treat as root-spawned.
	return nil, nil
}

// watchFiles monitors for new/modified subagent files
func (si *SubagentIndexer) watchFiles() {
	// Add watch on projects directory
	err := filepath.Walk(si.claudeProjects, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() && strings.Contains(path, "subagents") {
			si.watcher.Add(path)
		}
		return nil
	})
	if err != nil {
		log.Printf("⚠️ Error setting up subagent watches: %v", err)
	}

	debounceDelay := 500 * time.Millisecond

	for {
		select {
		case <-si.done:
			return
		case event, ok := <-si.watcher.Events:
			if !ok {
				return
			}
			if event.Op&(fsnotify.Write|fsnotify.Create) != 0 {
				if strings.HasPrefix(filepath.Base(event.Name), "agent-") && strings.HasSuffix(event.Name, ".jsonl") {
					si.scheduleIndex(event.Name, debounceDelay)
				}
			}
		case err, ok := <-si.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("⚠️ Subagent watcher error: %v", err)
		}
	}
}

// scheduleIndex schedules a file for indexing with debouncing
func (si *SubagentIndexer) scheduleIndex(filePath string, delay time.Duration) {
	si.mu.Lock()
	defer si.mu.Unlock()

	if timer, exists := si.debounceTimers[filePath]; exists {
		timer.Stop()
	}

	si.debounceTimers[filePath] = time.AfterFunc(delay, func() {
		select {
		case si.indexQueue <- filePath:
		default:
			log.Printf("⚠️ Subagent index queue full, dropping: %s", filePath)
		}
	})
}

// processIndexQueue handles queued index operations
func (si *SubagentIndexer) processIndexQueue() {
	for {
		select {
		case <-si.done:
			return
		case filePath, ok := <-si.indexQueue:
			if !ok {
				return
			}
			if err := si.indexFile(filePath); err != nil {
				log.Printf("⚠️ Error indexing queued file %s: %v", filePath, err)
			} else {
				log.Printf("🔄 Indexed subagent file: %s", filepath.Base(filePath))
			}
		}
	}
}
