package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
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
	indexer, err := service.NewConversationIndexer(storageService)
	if err != nil {
		logger.Fatalf("Failed to create conversation indexer: %v", err)
	}

	if err := indexer.Start(); err != nil {
		logger.Fatalf("Failed to start conversation indexer: %v", err)
	}
	defer indexer.Stop()
	logger.Println("Conversation indexer started")

	// Start subagent indexer
	subagentIndexer, err := service.NewSubagentIndexer(storageService)
	if err != nil {
		logger.Fatalf("Failed to create subagent indexer: %v", err)
	}

	if err := subagentIndexer.Start(); err != nil {
		logger.Fatalf("Failed to start subagent indexer: %v", err)
	}
	defer subagentIndexer.Stop()
	logger.Println("Subagent indexer started")

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

	// V3 API - realtime Mantine UI
	r.HandleFunc("/api/v3/overview", h.GetOverviewV3).Methods("GET")
	r.HandleFunc("/api/v3/mission-control", h.GetMissionControlV3).Methods("GET")
	r.HandleFunc("/api/v3/mission-control/activity", h.GetMissionControlActivityV3).Methods("GET")
	r.HandleFunc("/api/v3/sessions", h.GetSessionsV3).Methods("GET")
	r.HandleFunc("/api/v3/sessions/{id}", h.GetSessionV3).Methods("GET")
	r.HandleFunc("/api/v3/sessions/{id}/messages", h.GetSessionMessagesV3).Methods("GET")
	r.HandleFunc("/api/v3/conversations/{id}", h.GetConversationV3).Methods("GET")
	r.HandleFunc("/api/v3/plans/{id}", h.GetPlanV3).Methods("GET")
	r.HandleFunc("/api/v3/token-economics/summary", h.GetTokenEconomicsSummaryV3).Methods("GET")
	r.HandleFunc("/api/v3/token-economics/timeseries", h.GetTokenEconomicsTimeseriesV3).Methods("GET")
	r.HandleFunc("/api/v3/token-economics/projects", h.GetTokenEconomicsProjectsV3).Methods("GET")
	r.HandleFunc("/api/v3/extensions-config", h.GetExtensionsConfigV3).Methods("GET")
	r.HandleFunc("/api/v3/extensions-config/{type}/{id}", h.GetExtensionConfigDetailV3).Methods("GET")
	r.HandleFunc("/api/v3/extensions-config/plugins", h.GetExtensionsConfigPluginsV3).Methods("GET")
	r.HandleFunc("/api/v3/extensions-config/reindex", h.ReindexExtensionsV3).Methods("POST")
	r.HandleFunc("/api/v3/search", h.GetSearchV3).Methods("GET")
	r.HandleFunc("/api/v3/live/ws", h.LiveWSV3).Methods("GET")

	// [LAW:single-enforcer] Removed API surfaces are rejected at one boundary even when SPA assets are embedded.
	r.PathPrefix("/api/v2/").HandlerFunc(h.NotFound)
	r.PathPrefix("/api/stats").HandlerFunc(h.NotFound)
	r.PathPrefix("/api/conversations").HandlerFunc(h.NotFound)
	r.PathPrefix("/legacy").HandlerFunc(h.NotFound)
	r.PathPrefix("/api/").HandlerFunc(h.NotFound)

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
		r.NotFoundHandler = http.HandlerFunc(h.NotFound)
		logger.Println("Frontend not embedded - API-only mode")
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
		logger.Printf("   - GET  /api/v3/* (Runtime API)")
		logger.Printf("   - GET  /health")

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Server failed to start: %v", err)
		}
	}()

	// [LAW:dataflow-not-control-flow] Start artifact processing every boot with data-driven no-op behavior
	// for already-indexed records, instead of gating server startup on heavy work.
	startupCtx, cancelStartup := context.WithCancel(context.Background())
	defer cancelStartup()
	startBackgroundArtifactProcessing(startupCtx, logger, storageService)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Println("Shutting down viz-server...")
	cancelStartup()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatalf("Server forced to shutdown: %v", err)
	}

	logger.Println("viz-server exited")
}

func startBackgroundArtifactProcessing(ctx context.Context, logger *log.Logger, sqliteStorage *service.SQLiteStorageService) {
	go func() {
		logger.Println("Background artifact processing started")

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

		if ctx.Err() != nil {
			return
		}

		extensionIndexer := service.NewExtensionIndexer(sqliteStorage)
		if err := extensionIndexer.IndexExtensions(); err != nil {
			logger.Printf("Warning: Extension indexing failed: %v", err)
		} else {
			logger.Println("Extensions indexed")
		}

		if ctx.Err() != nil {
			return
		}

		relationshipLinker := service.NewRelationshipLinker(sqliteStorage)
		fileChangeCount, err := relationshipLinker.ExtractAndSaveFileChanges()
		if err != nil {
			logger.Printf("Warning: File change extraction failed: %v", err)
		} else {
			logger.Printf("File changes extracted: %d changes tracked", fileChangeCount)
		}

		if ctx.Err() != nil {
			return
		}

		homeDir, _ := os.UserHomeDir()
		plansDir := filepath.Join(homeDir, ".claude", "plans")
		planLinkCount, err := relationshipLinker.LinkPlansToSessions(plansDir)
		if err != nil {
			logger.Printf("Warning: Plan-session linking failed: %v", err)
		} else {
			logger.Printf("Plan-session links created: %d relationships", planLinkCount)
		}

		logger.Println("Background artifact processing complete")
	}()
}
