package handler

import (
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/brandon-fryslie/cc-viz/internal/model"
)

var v3Upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type v3LiveConn struct {
	conn        *websocket.Conn
	stateMu     sync.RWMutex
	writeMu     sync.Mutex
	topics      map[string]bool
	seqByTopic  map[string]int64
	hashByTopic map[string]string
}

type dbProvider interface {
	DB() *sql.DB
}

func (h *DataHandler) sqliteDB() (*sql.DB, error) {
	provider, ok := h.storageService.(dbProvider)
	if !ok {
		return nil, fmt.Errorf("runtime storage does not expose DB")
	}
	return provider.DB(), nil
}

// ============================================================================
// V3 Overview & Mission Control
// ============================================================================

func (h *DataHandler) buildOverviewV3(start, end string) (*model.V3OverviewResponse, error) {
	sessionStats, err := h.storageService.GetSessionStats()
	if err != nil {
		return nil, err
	}

	weeklyStats, err := h.storageService.GetStats(start, end)
	if err != nil {
		return nil, err
	}

	var totalTokens int64
	for _, day := range weeklyStats.DailyStats {
		totalTokens += day.Tokens
	}

	avgTokensPerSession := int64(0)
	if sessionStats.TotalSessions > 0 {
		avgTokensPerSession = totalTokens / int64(sessionStats.TotalSessions)
	}

	return &model.V3OverviewResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		KPIs: model.V3OverviewKPI{
			ActiveSessions:      sessionStats.ActiveSessions,
			TotalSessions:       sessionStats.TotalSessions,
			TotalMessages:       sessionStats.TotalMessages,
			ConversationsWindow: len(weeklyStats.DailyStats),
			TotalTokensWindow:   totalTokens,
			AvgTokensPerSession: avgTokensPerSession,
		},
	}, nil
}

func normalizeRange(start, end string) (string, string) {
	if start != "" && end != "" {
		return start, end
	}
	now := time.Now().UTC()
	return now.AddDate(0, 0, -7).Format(time.RFC3339), now.Format(time.RFC3339)
}

func (h *DataHandler) GetOverviewV3(w http.ResponseWriter, r *http.Request) {
	start, end := normalizeRange(r.URL.Query().Get("start"), r.URL.Query().Get("end"))
	overview, err := h.buildOverviewV3(start, end)
	if err != nil {
		writeErrorResponse(w, "Failed to build overview", http.StatusInternalServerError)
		return
	}
	writeJSONResponse(w, overview)
}

func (h *DataHandler) buildMissionControlV3(start, end string) (*model.V3MissionControlResponse, error) {
	overview, err := h.buildOverviewV3(start, end)
	if err != nil {
		return nil, err
	}

	hotSessions, err := h.storageService.GetSessions(20, 0)
	if err != nil {
		return nil, err
	}

	db, err := h.sqliteDB()
	if err != nil {
		return nil, err
	}

	var maxIndexedAt sql.NullString
	_ = db.QueryRow(`
		SELECT MAX(ts) FROM (
			SELECT MAX(indexed_at) AS ts FROM conversations
			UNION ALL
			SELECT MAX(indexed_at) AS ts FROM claude_todos
			UNION ALL
			SELECT MAX(indexed_at) AS ts FROM claude_plans
		)
	`).Scan(&maxIndexedAt)

	lagSeconds := int64(0)
	if maxIndexedAt.Valid {
		if parsed, err := time.Parse(time.RFC3339, maxIndexedAt.String); err == nil {
			lagSeconds = int64(time.Since(parsed).Seconds())
		}
	}

	return &model.V3MissionControlResponse{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		KPIs:        overview.KPIs,
		HotSessions: hotSessions,
		Health: model.V3MissionHealth{
			DBConnected: true,
			IndexerLag:  lagSeconds,
		},
	}, nil
}

func (h *DataHandler) GetMissionControlV3(w http.ResponseWriter, r *http.Request) {
	start, end := normalizeRange(r.URL.Query().Get("start"), r.URL.Query().Get("end"))
	payload, err := h.buildMissionControlV3(start, end)
	if err != nil {
		writeErrorResponse(w, "Failed to build mission control view", http.StatusInternalServerError)
		return
	}
	writeJSONResponse(w, payload)
}

func (h *DataHandler) GetMissionControlActivityV3(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	db, err := h.sqliteDB()
	if err != nil {
		writeErrorResponse(w, "Database unavailable", http.StatusInternalServerError)
		return
	}

	query := `
		SELECT id, type, ts, title, summary, session_id, conversation_id, route
		FROM (
			SELECT
				('session:' || id) AS id,
				'session' AS type,
				COALESCE(ended_at, started_at, created_at) AS ts,
				('Session ' || substr(id, 1, 8)) AS title,
				COALESCE(project_path, '') AS summary,
				id AS session_id,
				'' AS conversation_id,
				('/sessions/' || id) AS route
			FROM sessions
			UNION ALL
			SELECT
				('conversation:' || id) AS id,
				'conversation' AS type,
				end_time AS ts,
				COALESCE(project_name, 'Conversation') AS title,
				('messages: ' || message_count) AS summary,
				'' AS session_id,
				id AS conversation_id,
				('/conversations/' || id) AS route
			FROM conversations
			UNION ALL
			SELECT
				('todo:' || id) AS id,
				'todo' AS type,
				modified_at AS ts,
				'Todo update' AS title,
				substr(content, 1, 120) AS summary,
				session_uuid AS session_id,
				'' AS conversation_id,
				('/sessions/' || session_uuid || '?tab=todos&focus=todo:' || id) AS route
			FROM claude_todos
			UNION ALL
			SELECT
				('plan:' || id) AS id,
				'plan' AS type,
				modified_at AS ts,
				COALESCE(display_name, file_name) AS title,
				substr(preview, 1, 120) AS summary,
				COALESCE(session_uuid, '') AS session_id,
				'' AS conversation_id,
				('/plans/' || id) AS route
			FROM claude_plans
			UNION ALL
			SELECT
				('extension:' || id) AS id,
				'extension' AS type,
				updated_at AS ts,
				name AS title,
				(type || ' from ' || source) AS summary,
				'' AS session_id,
				'' AS conversation_id,
				('/extensions-config/' || type || '/' || id) AS route
			FROM extensions
		)
		WHERE ts IS NOT NULL
		ORDER BY ts DESC
		LIMIT ?
	`

	rows, err := db.Query(query, limit)
	if err != nil {
		writeErrorResponse(w, "Failed to load activity", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	events := make([]*model.V3ActivityEvent, 0, limit)
	for rows.Next() {
		var e model.V3ActivityEvent
		if err := rows.Scan(&e.ID, &e.Type, &e.Timestamp, &e.Title, &e.Summary, &e.SessionID, &e.ConversationID, &e.Route); err != nil {
			continue
		}
		events = append(events, &e)
	}

	writeJSONResponse(w, &model.V3ActivityResponse{Events: events, Limit: limit})
}

// ============================================================================
// V3 Sessions
// ============================================================================

func (h *DataHandler) GetSessionsV3(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}
	offset := 0
	if cursor := r.URL.Query().Get("cursor"); cursor != "" {
		if parsed, err := strconv.Atoi(cursor); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))

	db, err := h.sqliteDB()
	if err != nil {
		writeErrorResponse(w, "Database unavailable", http.StatusInternalServerError)
		return
	}

	where := ""
	args := []interface{}{}
	if q != "" {
		where = "WHERE id LIKE ? OR project_path LIKE ?"
		like := "%" + q + "%"
		args = append(args, like, like)
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM sessions %s", where)
	var total int
	if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		writeErrorResponse(w, "Failed to count sessions", http.StatusInternalServerError)
		return
	}

	query := fmt.Sprintf(`
		SELECT id, project_path, started_at, ended_at, conversation_count, message_count, agent_count, todo_count, created_at
		FROM sessions
		%s
		ORDER BY COALESCE(ended_at, started_at, created_at) DESC
		LIMIT ? OFFSET ?
	`, where)
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		writeErrorResponse(w, "Failed to query sessions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	sessions := make([]*model.Session, 0, limit)
	for rows.Next() {
		var s model.Session
		var startedAt, endedAt sql.NullString
		if err := rows.Scan(&s.ID, &s.ProjectPath, &startedAt, &endedAt, &s.ConversationCount, &s.MessageCount, &s.AgentCount, &s.TodoCount, &s.CreatedAt); err != nil {
			continue
		}
		if startedAt.Valid {
			if parsed, err := time.Parse(time.RFC3339, startedAt.String); err == nil {
				s.StartedAt = &parsed
			}
		}
		if endedAt.Valid {
			if parsed, err := time.Parse(time.RFC3339, endedAt.String); err == nil {
				s.EndedAt = &parsed
			}
		}
		sessions = append(sessions, &s)
	}

	nextCursor := ""
	if offset+len(sessions) < total {
		nextCursor = strconv.Itoa(offset + len(sessions))
	}

	writeJSONResponse(w, &model.V3SessionsResponse{Sessions: sessions, Total: total, NextCursor: nextCursor})
}

func (h *DataHandler) buildSessionDetailV3(sessionID string) (map[string]interface{}, error) {
	session, err := h.storageService.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, sql.ErrNoRows
	}

	conversations, err := h.storageService.GetSessionConversations(sessionID)
	if err != nil {
		conversations = []*model.IndexedConversation{}
	}
	if conversations == nil {
		conversations = []*model.IndexedConversation{}
	}
	files, err := h.storageService.GetSessionFileChanges(sessionID)
	if err != nil {
		files = []*model.SessionFileChange{}
	}
	if files == nil {
		files = []*model.SessionFileChange{}
	}
	plans, err := h.storageService.GetSessionPlans(sessionID)
	if err != nil {
		plans = []*model.Plan{}
	}
	if plans == nil {
		plans = []*model.Plan{}
	}
	todos, err := h.storageService.GetTodosBySession(sessionID)
	if err != nil {
		todos = []*model.Todo{}
	}
	if todos == nil {
		todos = []*model.Todo{}
	}

	return map[string]interface{}{
		"session":       session,
		"conversations": conversations,
		"files":         files,
		"plans":         plans,
		"todos":         todos,
	}, nil
}

func (h *DataHandler) GetSessionV3(w http.ResponseWriter, r *http.Request) {
	sessionID := mux.Vars(r)["id"]
	if sessionID == "" {
		writeErrorResponse(w, "Missing session ID", http.StatusBadRequest)
		return
	}

	payload, err := h.buildSessionDetailV3(sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeErrorResponse(w, "Session not found", http.StatusNotFound)
			return
		}
		writeErrorResponse(w, "Failed to load session", http.StatusInternalServerError)
		return
	}

	writeJSONResponse(w, payload)
}

func (h *DataHandler) GetSessionMessagesV3(w http.ResponseWriter, r *http.Request) {
	sessionID := mux.Vars(r)["id"]
	if sessionID == "" {
		writeErrorResponse(w, "Missing session ID", http.StatusBadRequest)
		return
	}
	limit := 100
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}
	if cursor := r.URL.Query().Get("cursor"); cursor != "" {
		if parsed, err := strconv.Atoi(cursor); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	db, err := h.sqliteDB()
	if err != nil {
		writeErrorResponse(w, "Database unavailable", http.StatusInternalServerError)
		return
	}

	var total int
	if err := db.QueryRow(`
		SELECT COUNT(*)
		FROM conversation_messages
		WHERE session_id = ? OR agent_id = ?
	`, sessionID, sessionID).Scan(&total); err != nil {
		writeErrorResponse(w, "Failed to count session messages", http.StatusInternalServerError)
		return
	}

	rows, err := db.Query(`
		SELECT uuid, conversation_id, parent_uuid, type, role, timestamp, cwd, git_branch, session_id, agent_id,
			is_sidechain, request_id, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
			content_json
		FROM conversation_messages
		WHERE session_id = ? OR agent_id = ?
		ORDER BY timestamp DESC
		LIMIT ? OFFSET ?
	`, sessionID, sessionID, limit, offset)
	if err != nil {
		writeErrorResponse(w, "Failed to query session messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	messages := make([]*model.DBConversationMessage, 0, limit)
	for rows.Next() {
		var m model.DBConversationMessage
		var parentUUID sql.NullString
		var role, cwd, gitBranch, sess, agentID, requestID, modelName sql.NullString
		var content sql.NullString
		var ts string
		if err := rows.Scan(
			&m.UUID,
			&m.ConversationID,
			&parentUUID,
			&m.Type,
			&role,
			&ts,
			&cwd,
			&gitBranch,
			&sess,
			&agentID,
			&m.IsSidechain,
			&requestID,
			&modelName,
			&m.InputTokens,
			&m.OutputTokens,
			&m.CacheReadTokens,
			&m.CacheCreationTokens,
			&content,
		); err != nil {
			continue
		}
		if parsed, err := time.Parse(time.RFC3339, ts); err == nil {
			m.Timestamp = parsed
		}
		if parentUUID.Valid {
			m.ParentUUID = &parentUUID.String
		}
		if role.Valid {
			m.Role = role.String
		}
		if cwd.Valid {
			m.CWD = cwd.String
		}
		if gitBranch.Valid {
			m.GitBranch = gitBranch.String
		}
		if sess.Valid {
			m.SessionID = sess.String
		}
		if agentID.Valid {
			m.AgentID = agentID.String
		}
		if requestID.Valid {
			m.RequestID = requestID.String
		}
		if modelName.Valid {
			m.Model = modelName.String
		}
		if content.Valid {
			m.Content = json.RawMessage(content.String)
		}
		messages = append(messages, &m)
	}

	nextCursor := ""
	if offset+len(messages) < total {
		nextCursor = strconv.Itoa(offset + len(messages))
	}

	writeJSONResponse(w, map[string]interface{}{
		"session_id":  sessionID,
		"messages":    messages,
		"total":       total,
		"next_cursor": nextCursor,
	})
}

func (h *DataHandler) GetConversationV3(w http.ResponseWriter, r *http.Request) {
	conversationID := mux.Vars(r)["id"]
	if conversationID == "" {
		writeErrorResponse(w, "Conversation ID is required", http.StatusBadRequest)
		return
	}

	filePath, projectPath, err := h.storageService.GetConversationFilePath(conversationID)
	if err != nil {
		writeErrorResponse(w, "Conversation not found", http.StatusNotFound)
		return
	}

	conversation, err := h.conversationService.GetConversation(projectPath, conversationID)
	if err != nil || conversation == nil {
		writeErrorResponse(w, "Conversation not found", http.StatusNotFound)
		return
	}

	writeJSONResponse(w, map[string]interface{}{
		"conversation": conversation,
		"file_path":    filePath,
		"project_path": projectPath,
	})
}

func (h *DataHandler) GetPlanV3(w http.ResponseWriter, r *http.Request) {
	planIDStr := mux.Vars(r)["id"]
	planID, err := strconv.Atoi(planIDStr)
	if err != nil {
		writeErrorResponse(w, "Invalid plan ID", http.StatusBadRequest)
		return
	}

	db, err := h.sqliteDB()
	if err != nil {
		writeErrorResponse(w, "Database unavailable", http.StatusInternalServerError)
		return
	}

	var plan model.Plan
	var modifiedAt string
	var sessionUUID sql.NullString
	if err := db.QueryRow(`
		SELECT id, file_name, display_name, content, preview, file_size, modified_at, session_uuid
		FROM claude_plans
		WHERE id = ?
	`, planID).Scan(
		&plan.ID,
		&plan.FileName,
		&plan.DisplayName,
		&plan.Content,
		&plan.Preview,
		&plan.FileSize,
		&modifiedAt,
		&sessionUUID,
	); err != nil {
		if err == sql.ErrNoRows {
			writeErrorResponse(w, "Plan not found", http.StatusNotFound)
			return
		}
		writeErrorResponse(w, "Failed to load plan", http.StatusInternalServerError)
		return
	}

	if parsed, err := time.Parse(time.RFC3339, modifiedAt); err == nil {
		plan.ModifiedAt = parsed
	}
	if sessionUUID.Valid {
		plan.SessionUUID = &sessionUUID.String
	}

	writeJSONResponse(w, plan)
}

// ============================================================================
// V3 Token Economics
// ============================================================================

func (h *DataHandler) GetTokenEconomicsSummaryV3(w http.ResponseWriter, r *http.Request) {
	start, end := normalizeRange(r.URL.Query().Get("start"), r.URL.Query().Get("end"))
	stats, err := h.storageService.GetStats(start, end)
	if err != nil {
		writeErrorResponse(w, "Failed to get token summary", http.StatusInternalServerError)
		return
	}

	if len(stats.DailyStats) == 0 {
		writeJSONResponse(w, &model.V3TokenSummaryResponse{GeneratedAt: time.Now().UTC().Format(time.RFC3339)})
		return
	}

	total := int64(0)
	peak := stats.DailyStats[0]
	for _, day := range stats.DailyStats {
		total += day.Tokens
		if day.Tokens > peak.Tokens {
			peak = day
		}
	}
	burn := total / int64(len(stats.DailyStats))

	trendPct := int64(0)
	if len(stats.DailyStats) >= 14 {
		recent := int64(0)
		previous := int64(0)
		for _, day := range stats.DailyStats[len(stats.DailyStats)-7:] {
			recent += day.Tokens
		}
		for _, day := range stats.DailyStats[len(stats.DailyStats)-14 : len(stats.DailyStats)-7] {
			previous += day.Tokens
		}
		if previous > 0 {
			trendPct = int64((float64(recent-previous) / float64(previous)) * 100)
		}
	}

	writeJSONResponse(w, &model.V3TokenSummaryResponse{
		GeneratedAt:    time.Now().UTC().Format(time.RFC3339),
		TotalTokens:    total,
		BurnRatePerDay: burn,
		PeakDayTokens:  peak.Tokens,
		PeakDayDate:    peak.Date,
		TrendPercent:   trendPct,
	})
}

func (h *DataHandler) GetTokenEconomicsTimeseriesV3(w http.ResponseWriter, r *http.Request) {
	start, end := normalizeRange(r.URL.Query().Get("start"), r.URL.Query().Get("end"))
	bucket := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("bucket")))
	if bucket == "" {
		bucket = "day"
	}

	resp := &model.V3TokenTimeseriesResponse{Bucket: bucket, Points: []*model.V3TokenTimeseriesPoint{}}
	if bucket == "hour" {
		hourly, err := h.storageService.GetHourlyStats(start, end)
		if err != nil {
			writeErrorResponse(w, "Failed to get hourly token series", http.StatusInternalServerError)
			return
		}
		for _, point := range hourly.HourlyStats {
			resp.Points = append(resp.Points, &model.V3TokenTimeseriesPoint{Bucket: strconv.Itoa(point.Hour), Tokens: point.Tokens, Requests: point.Requests})
		}
		writeJSONResponse(w, resp)
		return
	}

	weekly, err := h.storageService.GetStats(start, end)
	if err != nil {
		writeErrorResponse(w, "Failed to get daily token series", http.StatusInternalServerError)
		return
	}
	for _, day := range weekly.DailyStats {
		resp.Points = append(resp.Points, &model.V3TokenTimeseriesPoint{Bucket: day.Date, Tokens: day.Tokens, Requests: day.Requests})
	}
	writeJSONResponse(w, resp)
}

func (h *DataHandler) GetTokenEconomicsProjectsV3(w http.ResponseWriter, r *http.Request) {
	start, end := normalizeRange(r.URL.Query().Get("start"), r.URL.Query().Get("end"))
	projects, err := h.storageService.GetProjectTokenStats(start, end)
	if err != nil {
		writeErrorResponse(w, "Failed to get project token stats", http.StatusInternalServerError)
		return
	}
	writeJSONResponse(w, map[string]interface{}{"projects": projects})
}

// ============================================================================
// V3 Extensions & Config
// ============================================================================

func (h *DataHandler) loadClaudeConfigSnapshot() map[string]interface{} {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return map[string]interface{}{}
	}
	claudeDir := filepath.Join(homeDir, ".claude")
	response := map[string]interface{}{}

	settingsPath := filepath.Join(claudeDir, "settings.json")
	if settingsData, err := os.ReadFile(settingsPath); err == nil {
		var settings map[string]interface{}
		if err := json.Unmarshal(settingsData, &settings); err == nil {
			response["settings"] = settings
		}
	}

	claudeMdPath := filepath.Join(claudeDir, "CLAUDE.md")
	if claudeMdData, err := os.ReadFile(claudeMdPath); err == nil {
		response["claude_md"] = map[string]interface{}{
			"content":  string(claudeMdData),
			"sections": parseClaudeMdSections(string(claudeMdData)),
		}
	}

	mcpPath := filepath.Join(claudeDir, ".mcp.json")
	if mcpData, err := os.ReadFile(mcpPath); err == nil {
		var mcpConfig map[string]interface{}
		if err := json.Unmarshal(mcpData, &mcpConfig); err == nil {
			response["mcp"] = mcpConfig
		}
	}

	return response
}

func (h *DataHandler) GetExtensionsConfigV3(w http.ResponseWriter, r *http.Request) {
	extType := r.URL.Query().Get("type")
	source := r.URL.Query().Get("source")
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	enabledFilter := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("enabled")))
	pluginFilter := strings.TrimSpace(r.URL.Query().Get("plugin"))

	extensions, err := h.storageService.GetExtensionsFiltered(extType, source, q)
	if err != nil {
		writeErrorResponse(w, "Failed to get extensions", http.StatusInternalServerError)
		return
	}

	filtered := make([]*model.Extension, 0, len(extensions))
	for _, ext := range extensions {
		if enabledFilter == "true" && !ext.Enabled {
			continue
		}
		if enabledFilter == "false" && ext.Enabled {
			continue
		}
		if pluginFilter != "" {
			if ext.PluginID == nil || *ext.PluginID != pluginFilter {
				continue
			}
		}
		filtered = append(filtered, ext)
	}

	plugins, _ := h.storageService.GetPlugins()
	marketplaces, _ := h.storageService.GetMarketplaces()

	writeJSONResponse(w, &model.V3ExtensionsConfigResponse{
		Extensions:   filtered,
		Plugins:      plugins,
		Marketplaces: marketplaces,
		Config:       h.loadClaudeConfigSnapshot(),
		Total:        len(filtered),
	})
}

func (h *DataHandler) GetExtensionConfigDetailV3(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	extType := vars["type"]
	extID := vars["id"]
	if extType == "" || extID == "" {
		writeErrorResponse(w, "type and id are required", http.StatusBadRequest)
		return
	}

	ext, err := h.storageService.GetExtension(extType, extID)
	if err != nil {
		writeErrorResponse(w, "Extension not found", http.StatusNotFound)
		return
	}

	related := []*model.Extension{}
	if ext != nil {
		all, _ := h.storageService.GetExtensionsFiltered("", "", "")
		for _, candidate := range all {
			if candidate.ID == ext.ID {
				continue
			}
			if candidate.Type == ext.Type || candidate.Source == ext.Source {
				related = append(related, candidate)
			}
		}
	}

	writeJSONResponse(w, map[string]interface{}{
		"extension": ext,
		"related":   related,
		"config":    h.loadClaudeConfigSnapshot(),
	})
}

func (h *DataHandler) GetExtensionsConfigPluginsV3(w http.ResponseWriter, r *http.Request) {
	plugins, err := h.storageService.GetPlugins()
	if err != nil {
		writeErrorResponse(w, "Failed to get plugins", http.StatusInternalServerError)
		return
	}
	marketplaces, err := h.storageService.GetMarketplaces()
	if err != nil {
		writeErrorResponse(w, "Failed to get marketplaces", http.StatusInternalServerError)
		return
	}
	writeJSONResponse(w, map[string]interface{}{
		"plugins":      plugins,
		"marketplaces": marketplaces,
	})
}

// ============================================================================
// V3 Search
// ============================================================================

func splitTypes(typesParam string) map[string]bool {
	allowed := map[string]bool{
		"sessions": true, "conversations": true, "messages": true, "todos": true,
		"plans": true, "files": true, "extensions": true, "plugins": true, "config": true,
	}
	if typesParam == "" {
		return allowed
	}
	selected := map[string]bool{}
	for _, raw := range strings.Split(typesParam, ",") {
		key := strings.TrimSpace(strings.ToLower(raw))
		if allowed[key] {
			selected[key] = true
		}
	}
	if len(selected) == 0 {
		return allowed
	}
	return selected
}

func (h *DataHandler) GetSearchV3(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(query) < 2 {
		writeErrorResponse(w, "q requires at least 2 characters", http.StatusBadRequest)
		return
	}

	limit := 20
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	types := splitTypes(r.URL.Query().Get("types"))
	sections := map[string]model.V3SearchChunk{}

	if types["conversations"] || types["messages"] || types["todos"] || types["plans"] || types["extensions"] {
		unifiedTypes := []string{}
		if types["conversations"] || types["messages"] {
			unifiedTypes = append(unifiedTypes, "conversations")
		}
		if types["extensions"] {
			unifiedTypes = append(unifiedTypes, "extensions")
		}
		if types["todos"] {
			unifiedTypes = append(unifiedTypes, "todos")
		}
		if types["plans"] {
			unifiedTypes = append(unifiedTypes, "plans")
		}

		results, err := h.storageService.SearchUnified(query, unifiedTypes, limit, offset, "", "")
		if err == nil && results != nil {
			if results.Conversations != nil {
				items := make([]interface{}, 0, len(results.Conversations.Results))
				for _, c := range results.Conversations.Results {
					items = append(items, map[string]interface{}{
						"id":           c.ConversationID,
						"project_name": c.ProjectName,
						"preview":      c.Preview,
						"match_count":  c.MatchCount,
						"route":        "/conversations/" + c.ConversationID,
					})
				}
				sections["conversations"] = model.V3SearchChunk{Total: results.Conversations.Total, Results: items}
			}
			if results.Extensions.Results != nil {
				rows := []interface{}{}
				extRows, ok := results.Extensions.Results.([]*model.ExtensionSearchResult)
				if ok {
					for _, ext := range extRows {
						rows = append(rows, map[string]interface{}{
							"id":      ext.ID,
							"type":    ext.Type,
							"name":    ext.Name,
							"source":  ext.Source,
							"snippet": ext.Snippet,
							"route":   "/extensions-config/" + ext.Type + "/" + ext.ID,
						})
					}
				}
				sections["extensions"] = model.V3SearchChunk{Total: results.Extensions.Total, Results: rows}
			}
			if results.Todos.Results != nil {
				rows := []interface{}{}
				todoRows, ok := results.Todos.Results.([]*model.TodoSearchResult)
				if ok {
					for _, todo := range todoRows {
						rows = append(rows, map[string]interface{}{
							"id":           todo.ID,
							"session_uuid": todo.SessionUUID,
							"snippet":      todo.Snippet,
							"status":       todo.Status,
							"route":        "/sessions/" + todo.SessionUUID + "?tab=todos&focus=todo:" + strconv.Itoa(todo.ID),
						})
					}
				}
				sections["todos"] = model.V3SearchChunk{Total: results.Todos.Total, Results: rows}
			}
			if results.Plans.Results != nil {
				rows := []interface{}{}
				planRows, ok := results.Plans.Results.([]*model.PlanSearchResult)
				if ok {
					for _, plan := range planRows {
						rows = append(rows, map[string]interface{}{
							"id":           plan.ID,
							"display_name": plan.DisplayName,
							"snippet":      plan.Snippet,
							"session_uuid": plan.SessionUUID,
							"route":        "/plans/" + strconv.Itoa(plan.ID),
						})
					}
				}
				sections["plans"] = model.V3SearchChunk{Total: results.Plans.Total, Results: rows}
			}
		}
	}

	db, dbErr := h.sqliteDB()
	if dbErr == nil {
		if types["sessions"] {
			rows, err := db.Query(`
				SELECT id, COALESCE(project_path, ''), message_count
				FROM sessions
				WHERE id LIKE ? OR project_path LIKE ?
				ORDER BY COALESCE(ended_at, started_at, created_at) DESC
				LIMIT ? OFFSET ?
			`, "%"+query+"%", "%"+query+"%", limit, offset)
			if err == nil {
				defer rows.Close()
				items := []interface{}{}
				for rows.Next() {
					var id, project string
					var messageCount int
					if err := rows.Scan(&id, &project, &messageCount); err == nil {
						items = append(items, map[string]interface{}{
							"id":            id,
							"project_path":  project,
							"message_count": messageCount,
							"route":         "/sessions/" + id,
						})
					}
				}
				sections["sessions"] = model.V3SearchChunk{Total: len(items), Results: items}
			}
		}

		if types["messages"] {
			rows, err := db.Query(`
				SELECT uuid, COALESCE(NULLIF(session_id, ''), NULLIF(agent_id, '')), conversation_id, COALESCE(model, ''), timestamp, substr(COALESCE(content_json, ''), 1, 240)
				FROM conversation_messages
				WHERE (
					content_json LIKE ?
					OR uuid LIKE ?
					OR conversation_id LIKE ?
					OR model LIKE ?
				)
				ORDER BY timestamp DESC
				LIMIT ? OFFSET ?
			`, "%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%", limit, offset)
			if err == nil {
				defer rows.Close()
				items := []interface{}{}
				for rows.Next() {
					var uuid string
					var sessionID sql.NullString
					var conversationID sql.NullString
					var modelName sql.NullString
					var ts string
					var snippet sql.NullString
					if err := rows.Scan(&uuid, &sessionID, &conversationID, &modelName, &ts, &snippet); err != nil {
						continue
					}

					route := ""
					if sessionID.Valid && sessionID.String != "" {
						route = "/sessions/" + sessionID.String + "?tab=messages&focus=message:" + uuid
					} else if conversationID.Valid && conversationID.String != "" {
						route = "/conversations/" + conversationID.String
					}

					items = append(items, map[string]interface{}{
						"id":              uuid,
						"session_id":      sessionID.String,
						"conversation_id": conversationID.String,
						"model":           modelName.String,
						"timestamp":       ts,
						"snippet":         snippet.String,
						"route":           route,
					})
				}
				sections["messages"] = model.V3SearchChunk{Total: len(items), Results: items}
			}
		}

		if types["files"] {
			rows, err := db.Query(`
				SELECT id, session_id, file_path, COALESCE(timestamp, created_at)
				FROM session_file_changes
				WHERE file_path LIKE ?
				ORDER BY COALESCE(timestamp, created_at) DESC
				LIMIT ? OFFSET ?
			`, "%"+query+"%", limit, offset)
			if err == nil {
				defer rows.Close()
				items := []interface{}{}
				for rows.Next() {
					var id int
					var sessionID, filePath, ts string
					if err := rows.Scan(&id, &sessionID, &filePath, &ts); err == nil {
						items = append(items, map[string]interface{}{
							"id":         id,
							"session_id": sessionID,
							"file_path":  filePath,
							"timestamp":  ts,
							"route":      "/sessions/" + sessionID + "?tab=files&focus=file:" + filePath,
						})
					}
				}
				sections["files"] = model.V3SearchChunk{Total: len(items), Results: items}
			}
		}
	}

	if types["plugins"] {
		plugins, err := h.storageService.GetPlugins()
		if err == nil {
			items := []interface{}{}
			for _, plugin := range plugins {
				if strings.Contains(strings.ToLower(plugin.Name), strings.ToLower(query)) || strings.Contains(strings.ToLower(plugin.ID), strings.ToLower(query)) {
					items = append(items, map[string]interface{}{
						"id":          plugin.ID,
						"name":        plugin.Name,
						"marketplace": plugin.Marketplace,
						"route":       "/extensions-config?plugin=" + plugin.ID,
					})
				}
			}
			sections["plugins"] = model.V3SearchChunk{Total: len(items), Results: items}
		}
	}

	if types["config"] {
		snapshot := h.loadClaudeConfigSnapshot()
		items := []interface{}{}
		queryLower := strings.ToLower(query)
		if claudeRaw, ok := snapshot["claude_md"].(map[string]interface{}); ok {
			if content, ok := claudeRaw["content"].(string); ok && strings.Contains(strings.ToLower(content), queryLower) {
				items = append(items, map[string]interface{}{"id": "claude_md", "title": "CLAUDE.md", "route": "/extensions-config?configTab=claude_md"})
			}
		}
		if settings, ok := snapshot["settings"]; ok {
			serialized, _ := json.Marshal(settings)
			if strings.Contains(strings.ToLower(string(serialized)), queryLower) {
				items = append(items, map[string]interface{}{"id": "settings", "title": "settings.json", "route": "/extensions-config?configTab=settings"})
			}
		}
		if mcp, ok := snapshot["mcp"]; ok {
			serialized, _ := json.Marshal(mcp)
			if strings.Contains(strings.ToLower(string(serialized)), queryLower) {
				items = append(items, map[string]interface{}{"id": "mcp", "title": ".mcp.json", "route": "/extensions-config?configTab=mcp"})
			}
		}
		sections["config"] = model.V3SearchChunk{Total: len(items), Results: items}
	}

	writeJSONResponse(w, &model.V3SearchResponse{Query: query, Sections: sections})
}

// ============================================================================
// V3 Live Websocket
// ============================================================================

func stableHash(data interface{}) string {
	payload, _ := json.Marshal(data)
	h := sha1.Sum(payload)
	return hex.EncodeToString(h[:])
}

func stableTopicHash(topic string, payload interface{}) string {
	switch snapshot := payload.(type) {
	case *model.V3OverviewResponse:
		normalized := *snapshot
		normalized.GeneratedAt = ""
		return stableHash(normalized)
	case *model.V3MissionControlResponse:
		normalized := *snapshot
		normalized.GeneratedAt = ""
		// [LAW:one-source-of-truth] Indexer lag is a time-derived display value, not a canonical data change signal.
		normalized.Health.IndexerLag = 0
		return stableHash(normalized)
	default:
		_ = topic
		return stableHash(payload)
	}
}

func (lc *v3LiveConn) sendJSON(v interface{}) error {
	lc.writeMu.Lock()
	defer lc.writeMu.Unlock()
	_ = lc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return lc.conn.WriteJSON(v)
}

func (lc *v3LiveConn) subscribe(topics []string) []string {
	lc.stateMu.Lock()
	defer lc.stateMu.Unlock()
	for _, topic := range topics {
		if topic == "" {
			continue
		}
		lc.topics[topic] = true
	}
	current := make([]string, 0, len(lc.topics))
	for topic := range lc.topics {
		current = append(current, topic)
	}
	sort.Strings(current)
	return current
}

func (lc *v3LiveConn) unsubscribe(topics []string) {
	lc.stateMu.Lock()
	defer lc.stateMu.Unlock()
	for _, topic := range topics {
		delete(lc.topics, topic)
	}
}

func (lc *v3LiveConn) listTopics() []string {
	lc.stateMu.RLock()
	defer lc.stateMu.RUnlock()
	current := make([]string, 0, len(lc.topics))
	for topic := range lc.topics {
		current = append(current, topic)
	}
	sort.Strings(current)
	return current
}

func (lc *v3LiveConn) markSnapshot(topic, hash string) (int64, bool) {
	lc.stateMu.Lock()
	defer lc.stateMu.Unlock()
	if lc.hashByTopic[topic] == hash {
		return 0, false
	}
	lc.hashByTopic[topic] = hash
	lc.seqByTopic[topic]++
	return lc.seqByTopic[topic], true
}

func (h *DataHandler) v3TopicSnapshot(topic string) (interface{}, error) {
	now := time.Now().UTC()
	windowStart := now.AddDate(0, 0, -7).Format(time.RFC3339)
	windowEnd := now.Format(time.RFC3339)

	switch {
	case topic == "overview":
		return h.buildOverviewV3(windowStart, windowEnd)
	case topic == "mission_control":
		return h.buildMissionControlV3(windowStart, windowEnd)
	case topic == "sessions":
		stats, err := h.storageService.GetSessionStats()
		if err != nil {
			return nil, err
		}
		sessions, err := h.storageService.GetSessions(50, 0)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{"stats": stats, "sessions": sessions}, nil
	case strings.HasPrefix(topic, "session:"):
		sessionID := strings.TrimPrefix(topic, "session:")
		return h.buildSessionDetailV3(sessionID)
	case topic == "token_economics":
		summary, err := h.storageService.GetStats(windowStart, windowEnd)
		if err != nil {
			return nil, err
		}
		projects, err := h.storageService.GetProjectTokenStats(windowStart, windowEnd)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{"daily": summary.DailyStats, "projects": projects}, nil
	case topic == "extensions_config":
		extensions, err := h.storageService.GetExtensionsFiltered("", "", "")
		if err != nil {
			return nil, err
		}
		plugins, _ := h.storageService.GetPlugins()
		return map[string]interface{}{"extensions": extensions, "plugins": plugins}, nil
	default:
		return nil, fmt.Errorf("unsupported topic: %s", topic)
	}
}

func (h *DataHandler) streamTopicSnapshot(lc *v3LiveConn, topic string) {
	payload, err := h.v3TopicSnapshot(topic)
	if err != nil {
		_ = lc.sendJSON(&model.V3LiveServerMessage{Op: "error", Code: "topic_snapshot_failed", Message: err.Error(), TS: time.Now().UTC().Format(time.RFC3339)})
		return
	}

	hash := stableTopicHash(topic, payload)
	// [LAW:single-enforcer] Sequence/hash convergence is enforced in one state transition.
	seq, changed := lc.markSnapshot(topic, hash)
	if !changed {
		return
	}
	_ = lc.sendJSON(&model.V3LiveServerMessage{
		Op:    "event",
		Topic: topic,
		Event: "replace",
		Seq:   seq,
		TS:    time.Now().UTC().Format(time.RFC3339),
		Data:  payload,
	})
}

func (h *DataHandler) LiveWSV3(w http.ResponseWriter, r *http.Request) {
	conn, err := v3Upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("v3 websocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	live := &v3LiveConn{
		conn:        conn,
		topics:      map[string]bool{},
		seqByTopic:  map[string]int64{},
		hashByTopic: map[string]string{},
	}

	if err := live.sendJSON(&model.V3LiveServerMessage{
		Op:         "ready",
		ServerTime: time.Now().UTC().Format(time.RFC3339),
		Topics:     []string{},
	}); err != nil {
		return
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			var clientMsg model.V3LiveClientMessage
			if err := conn.ReadJSON(&clientMsg); err != nil {
				return
			}

			switch clientMsg.Op {
			case "subscribe":
				current := live.subscribe(clientMsg.Topics)
				for _, topic := range clientMsg.Topics {
					if topic != "" {
						h.streamTopicSnapshot(live, topic)
					}
				}
				_ = live.sendJSON(&model.V3LiveServerMessage{Op: "ready", ServerTime: time.Now().UTC().Format(time.RFC3339), Topics: current})
			case "unsubscribe":
				live.unsubscribe(clientMsg.Topics)
			case "ping":
				_ = live.sendJSON(&model.V3LiveServerMessage{Op: "heartbeat", TS: time.Now().UTC().Format(time.RFC3339)})
			default:
				_ = live.sendJSON(&model.V3LiveServerMessage{Op: "error", Code: "invalid_op", Message: "unsupported op", TS: time.Now().UTC().Format(time.RFC3339)})
			}
		}
	}()

	eventTicker := time.NewTicker(1 * time.Second)
	defer eventTicker.Stop()
	heartbeatTicker := time.NewTicker(15 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-done:
			return
		case <-eventTicker.C:
			for _, topic := range live.listTopics() {
				h.streamTopicSnapshot(live, topic)
			}
		case <-heartbeatTicker.C:
			_ = live.sendJSON(&model.V3LiveServerMessage{Op: "heartbeat", TS: time.Now().UTC().Format(time.RFC3339)})
		}
	}
}
