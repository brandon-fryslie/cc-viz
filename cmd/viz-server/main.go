package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"

	"github.com/brandon-fryslie/cc-viz/internal/config"
	"github.com/brandon-fryslie/cc-viz/internal/handler"
	"github.com/brandon-fryslie/cc-viz/internal/middleware"
	"github.com/brandon-fryslie/cc-viz/internal/service"
)

func main() {
	logger := log.New(os.Stdout, "viz-server: ", log.LstdFlags|log.Lshortfile)

	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("Failed to load configuration: %v", err)
	}

	// Use SQLite storage (full read/write access)
	storageService, err := service.NewSQLiteStorageService(&cfg.Storage)
	if err != nil {
		logger.Fatalf("Failed to initialize SQLite storage: %v", err)
	}
	logger.Println("SQLite database ready")

	// Start conversation indexer (fail-fast on error)
	sqliteStorage, ok := storageService.(*service.SQLiteStorageService)
	if !ok {
		logger.Fatalf("Storage service must be SQLite for indexer support")
	}

	indexer, err := service.NewConversationIndexer(sqliteStorage)
	if err != nil {
		logger.Fatalf("Failed to create conversation indexer: %v", err)
	}

	if err := indexer.Start(); err != nil {
		logger.Fatalf("Failed to start conversation indexer: %v", err)
	}
	defer indexer.Stop()
	logger.Println("Conversation indexer started")

	// Start subagent indexer
	subagentIndexer, err := service.NewSubagentIndexer(sqliteStorage)
	if err != nil {
		logger.Fatalf("Failed to create subagent indexer: %v", err)
	}

	if err := subagentIndexer.Start(); err != nil {
		logger.Fatalf("Failed to start subagent indexer: %v", err)
	}
	defer subagentIndexer.Stop()
	logger.Println("Subagent indexer started")

	// Run session data indexer (initial index of todos/plans from ~/.claude)
	sessionDataIndexer, err := service.NewSessionDataIndexer(sqliteStorage)
	if err != nil {
		logger.Printf("Warning: Failed to create session data indexer: %v", err)
	} else {
		filesProcessed, todosIndexed, indexErrors := sessionDataIndexer.IndexTodos()
		if len(indexErrors) > 0 {
			logger.Printf("Session data todos: %d files, %d todos, %d errors", filesProcessed, todosIndexed, len(indexErrors))
		} else {
			logger.Printf("Session data todos indexed: %d files, %d todos", filesProcessed, todosIndexed)
		}

		plansProcessed, planErrors := sessionDataIndexer.IndexPlans()
		if len(planErrors) > 0 {
			logger.Printf("Session data plans: %d files, %d errors", plansProcessed, len(planErrors))
		} else {
			logger.Printf("Session data plans indexed: %d files", plansProcessed)
		}
	}

	// Run extension indexer (initial index of plugins/extensions from ~/.claude)
	extensionIndexer := service.NewExtensionIndexer(sqliteStorage)
	if err := extensionIndexer.IndexExtensions(); err != nil {
		logger.Printf("Warning: Extension indexing failed: %v", err)
	} else {
		logger.Println("Extensions indexed")
	}

	// Run relationship linker to extract file changes from tool outputs
	relationshipLinker := service.NewRelationshipLinker(sqliteStorage)
	fileChangeCount, err := relationshipLinker.ExtractAndSaveFileChanges()
	if err != nil {
		logger.Printf("Warning: File change extraction failed: %v", err)
	} else {
		logger.Printf("File changes extracted: %d changes tracked", fileChangeCount)
	}

	// Link plans to sessions based on UUID extraction
	homeDir, _ := os.UserHomeDir()
	plansDir := filepath.Join(homeDir, ".claude", "plans")
	planLinkCount, err := relationshipLinker.LinkPlansToSessions(plansDir)
	if err != nil {
		logger.Printf("Warning: Plan-session linking failed: %v", err)
	} else {
		logger.Printf("Plan-session links created: %d relationships", planLinkCount)
	}

	// Queue watcher is mandatory - fail if queue directory not configured
	if cfg.Queue.Directory == "" {
		logger.Fatalf("Queue directory not configured. Set queue.directory in config.yaml")
	}

	queueWatcher, err := service.NewQueueWatcher(
		cfg.Queue.Directory,
		cfg.Queue.DeadLetterDir,
		sqliteStorage,
		logger,
	)
	if err != nil {
		logger.Fatalf("Failed to create queue watcher: %v", err)
	}

	if err := queueWatcher.Start(); err != nil {
		logger.Fatalf("Failed to start queue watcher: %v", err)
	}
	defer queueWatcher.Stop()
	logger.Printf("Queue watcher started, monitoring: %s", cfg.Queue.Directory)

	// Create data handler (full dependencies)
	h := handler.NewDataHandler(storageService, logger, cfg)
	h.SetIndexer(indexer)

	r := mux.NewRouter()

	corsHandler := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"*"}),
	)

	r.Use(middleware.Logging)

	// Health check
	r.HandleFunc("/health", h.Health).Methods("GET")

	// V1 API - Request endpoints
	r.HandleFunc("/api/requests", h.GetRequests).Methods("GET")
	r.HandleFunc("/api/requests/summary", h.GetRequestsSummary).Methods("GET")
	r.HandleFunc("/api/requests/latest-date", h.GetLatestRequestDate).Methods("GET")
	r.HandleFunc("/api/requests/{id}", h.GetRequestByID).Methods("GET")
	r.HandleFunc("/api/requests", h.DeleteRequests).Methods("DELETE")

	// V1 API - Stats endpoints
	r.HandleFunc("/api/stats", h.GetStats).Methods("GET")
	r.HandleFunc("/api/stats/hourly", h.GetHourlyStats).Methods("GET")
	r.HandleFunc("/api/stats/models", h.GetModelStats).Methods("GET")
	r.HandleFunc("/api/stats/providers", h.GetProviderStats).Methods("GET")
	r.HandleFunc("/api/stats/subagents", h.GetSubagentStats).Methods("GET")
	r.HandleFunc("/api/stats/tools", h.GetToolStats).Methods("GET")
	r.HandleFunc("/api/stats/performance", h.GetPerformanceStats).Methods("GET")

	// V1 API - Conversation endpoints (specific routes before parameterized)
	r.HandleFunc("/api/conversations", h.GetConversations).Methods("GET")
	r.HandleFunc("/api/conversations/search", h.SearchConversations).Methods("GET")
	r.HandleFunc("/api/conversations/project", h.GetConversationsByProject).Methods("GET")
	r.HandleFunc("/api/conversations/{id}", h.GetConversationByID).Methods("GET")

	// V2 API - cleaner response format for new dashboard
	r.HandleFunc("/api/v2/search", h.SearchUnifiedV2).Methods("GET")
	r.HandleFunc("/api/v2/requests/search", h.SearchRequestsV2).Methods("GET")
	r.HandleFunc("/api/v2/requests/summary", h.GetRequestsSummaryV2).Methods("GET")
	r.HandleFunc("/api/v2/requests/{id}", h.GetRequestByIDV2).Methods("GET")
	r.HandleFunc("/api/v2/conversations", h.GetConversationsV2).Methods("GET")
	r.HandleFunc("/api/v2/conversations/search", h.SearchConversations).Methods("GET")
	r.HandleFunc("/api/v2/conversations/reindex", h.ReindexConversationsV2).Methods("POST")
	// Specific routes must be registered BEFORE generic {id} routes
	r.HandleFunc("/api/v2/conversations/{id}/messages", h.GetConversationMessagesV2).Methods("GET")
	r.HandleFunc("/api/v2/conversations/{id}", h.GetConversationByIDV2).Methods("GET")
	// Token Economics endpoints (must be after specific {id} routes to avoid route conflicts)
	r.HandleFunc("/api/v2/conversations/{id}/token-summary", h.GetConversationTokenSummaryV2).Methods("GET")
	r.HandleFunc("/api/v2/conversations/with-tokens", h.GetConversationsWithTokensV2).Methods("GET")
	r.HandleFunc("/api/v2/stats/projects", h.GetProjectTokenStatsV2).Methods("GET")

	r.HandleFunc("/api/v2/stats", h.GetWeeklyStatsV2).Methods("GET")
	r.HandleFunc("/api/v2/stats/hourly", h.GetHourlyStatsV2).Methods("GET")
	r.HandleFunc("/api/v2/stats/models", h.GetModelStatsV2).Methods("GET")
	r.HandleFunc("/api/v2/stats/providers", h.GetProvidersV2).Methods("GET")
	r.HandleFunc("/api/v2/stats/subagents", h.GetSubagentStatsV2).Methods("GET")
	r.HandleFunc("/api/v2/stats/performance", h.GetPerformanceStatsV2).Methods("GET")

	// V2 Configuration API
	r.HandleFunc("/api/v2/config", h.GetConfigV2).Methods("GET")
	r.HandleFunc("/api/v2/config/providers", h.GetProvidersV2).Methods("GET")
	r.HandleFunc("/api/v2/config/subagents", h.GetSubagentConfigV2).Methods("GET")

	// CC-VIZ Claude Directory API
	r.HandleFunc("/api/v2/claude/config", h.GetClaudeConfigV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/projects", h.GetClaudeProjectsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/projects/{id}", h.GetClaudeProjectDetailV2).Methods("GET")

	// CC-VIZ Session Data API
	r.HandleFunc("/api/v2/claude/todos", h.GetTodosV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/todos/search", h.SearchTodosV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/todos/reindex", h.ReindexTodosV2).Methods("POST")
	r.HandleFunc("/api/v2/claude/todos/{session_uuid}", h.GetTodoDetailV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/plans", h.GetPlansV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/plans/search", h.SearchPlansV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/plans/{id}", h.GetPlanDetailV2).Methods("GET")

	// CC-VIZ Extension API
	r.HandleFunc("/api/v2/claude/extensions", h.GetExtensionsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/extensions/{type}/{id}", h.GetExtensionDetailV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/extensions/plugin/{id}/toggle", h.ToggleExtensionV2).Methods("POST")
	r.HandleFunc("/api/v2/claude/extensions/stats", h.GetExtensionStatsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/extensions/reindex", h.ReindexExtensionsV2).Methods("POST")
	r.HandleFunc("/api/v2/plugins", h.GetPluginsV2).Methods("GET")
	r.HandleFunc("/api/v2/plugins/{id}", h.GetPluginDetailV2).Methods("GET")
	r.HandleFunc("/api/v2/marketplaces", h.GetMarketplacesV2).Methods("GET")

	// CC-VIZ Subagent Graph API
	r.HandleFunc("/api/v2/claude/subagent-graph/hierarchy", h.GetSubagentHierarchyV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/subagent-graph/stats", h.GetSubagentGraphStatsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/subagent-graph/hierarchy/{session_id}/agent/{agent_id}", h.GetSubagentGraphAgentV2).Methods("GET")

	// CC-VIZ Sessions API
	r.HandleFunc("/api/v2/claude/sessions", h.GetSessionsV2).Methods("GET")
	// Specific session routes BEFORE generic {id} route
	r.HandleFunc("/api/v2/claude/sessions/stats", h.GetSessionStatsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/sessions/{id}/conversations", h.GetSessionConversationsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/sessions/{id}/files", h.GetSessionFileChangesV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/sessions/{id}/plans", h.GetSessionPlansV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/plans/{id}/sessions", h.GetPlanSessionsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/sessions/{id}", h.GetSessionDetailV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/conversations/{id}/sessions", h.GetConversationSessionsV2).Methods("GET")
	r.HandleFunc("/api/v2/claude/files", h.GetFileSessionsV2).Methods("GET")

	// Frontend static files (when embedded)
	// SINGLE SOURCE OF TRUTH: embedFrontend variable set by build tags
	if embedFrontend {
		staticHandler, err := handler.NewStaticHandler(frontendFS, "viz-frontend-embed", logger)
		if err != nil {
			logger.Fatalf("Failed to create static handler: %v", err)
		}

		// Register SPA handler LAST (after all API routes)
		// This ensures API routes take precedence
		r.PathPrefix("/").Handler(staticHandler)
		logger.Println("Frontend embedded and will be served at /")
	} else {
		// No frontend embedded - serve legacy UI or 404
		r.HandleFunc("/", h.UI).Methods("GET")
		r.HandleFunc("/ui", h.UI).Methods("GET")
		r.NotFoundHandler = http.HandlerFunc(h.NotFound)
		logger.Println("Frontend not embedded - using legacy UI handler")
	}

	// Get port from environment or default
	port := os.Getenv("PROXY_DATA_PORT")
	if port == "" {
		port = "8002"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      corsHandler(r),
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	go func() {
		logger.Printf("viz-server running on http://localhost:%s", port)
		logger.Printf("Dashboard API endpoints available at:")
		logger.Printf("   - GET  /api/requests (Request data)")
		logger.Printf("   - GET  /api/stats (Statistics)")
		logger.Printf("   - GET  /api/conversations (Conversations)")
		logger.Printf("   - GET  /api/v2/* (V2 API)")
		logger.Printf("   - GET  /api/v2/claude/subagent-graph/* (Subagent Graph)")
		logger.Printf("   - GET  /health")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Server failed to start: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Println("Shutting down viz-server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatalf("Server forced to shutdown: %v", err)
	}

	logger.Println("viz-server exited")
}
