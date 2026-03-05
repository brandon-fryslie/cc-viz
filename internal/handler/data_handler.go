package handler

import (
	"log"
	"net/http"
	"time"

	"github.com/brandon-fryslie/cc-viz/internal/config"
	"github.com/brandon-fryslie/cc-viz/internal/service"
)

// DataHandler serves the v3 runtime API.
// [LAW:one-source-of-truth] Runtime endpoints are backed by one runtime storage contract.
type DataHandler struct {
	storageService      service.RuntimeStorageService
	conversationService service.ConversationService
	indexer             *service.ConversationIndexer
	logger              *log.Logger
	config              *config.Config
}

func NewDataHandler(storageService service.RuntimeStorageService, logger *log.Logger, cfg *config.Config) *DataHandler {
	return &DataHandler{
		storageService:      storageService,
		conversationService: service.NewConversationService(),
		logger:              logger,
		config:              cfg,
	}
}

func (h *DataHandler) SetIndexer(indexer *service.ConversationIndexer) {
	h.indexer = indexer
}

func (h *DataHandler) Health(w http.ResponseWriter, _ *http.Request) {
	dbStatus := "connected"
	if h.storageService == nil {
		dbStatus = "disconnected"
	}

	indexerStatus := "not_configured"
	if h.indexer != nil {
		indexerStatus = "running"
	}

	writeJSONResponse(w, map[string]interface{}{
		"status":    "ok",
		"service":   "viz-server",
		"database":  dbStatus,
		"indexer":   indexerStatus,
		"timestamp": time.Now().UTC(),
	})
}

func (h *DataHandler) NotFound(w http.ResponseWriter, _ *http.Request) {
	writeErrorResponse(w, "Not found", http.StatusNotFound)
}
