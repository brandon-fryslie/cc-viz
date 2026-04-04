package app

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"sync"
	"syscall"
	"time"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/config"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/parser"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/rollup"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/sink/victoriametrics"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/source"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/state"
)

type Exporter struct {
	cfg    *config.Config
	store  *state.Store
	sink   *victoriametrics.Client
	logger *log.Logger
	now    func() time.Time
	health *healthState
}

type healthState struct {
	mu           sync.RWMutex
	LastScanAt   string `json:"last_scan_at"`
	LastExportAt string `json:"last_export_at"`
	LastError    string `json:"last_error"`
	DirtyBuckets int    `json:"dirty_buckets"`
}

func New(cfg *config.Config, store *state.Store, sink *victoriametrics.Client, logger *log.Logger) *Exporter {
	return &Exporter{
		cfg:    cfg,
		store:  store,
		sink:   sink,
		logger: logger,
		now:    time.Now,
		health: &healthState{},
	}
}

func (e *Exporter) RunServe(ctx context.Context) error {
	healthServer := e.startHealthServer()
	defer func() {
		if healthServer != nil {
			_ = healthServer.Close()
		}
	}()

	if err := e.SyncOnce(ctx, nil, false); err != nil {
		return err
	}

	ticker := time.NewTicker(e.cfg.Sync.PollIntervalDur)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := e.SyncOnce(ctx, nil, false); err != nil {
				e.logger.Printf("sync failed: %v", err)
				e.recordError(err)
			}
		}
	}
}

func (e *Exporter) RunBackfill(ctx context.Context, from, to time.Time) error {
	window := &state.TimeWindow{
		From: rollup.HourStartUTC(from.UTC()),
		To:   rollup.HourStartUTC(to.UTC()),
	}
	if err := e.SyncOnce(ctx, window, true); err != nil {
		return err
	}
	return nil
}

func (e *Exporter) SyncOnce(ctx context.Context, exportWindow *state.TimeWindow, forceExport bool) error {
	scannedAt := e.now().UTC()
	files, err := source.ScanProjects(e.cfg.Source.ProjectsDir)
	if err != nil {
		e.recordError(err)
		return err
	}

	knownFiles, err := e.store.ListSourceFiles(ctx)
	if err != nil {
		e.recordError(err)
		return err
	}

	knownByPath := make(map[string]state.SourceFile, len(knownFiles))
	for _, file := range knownFiles {
		knownByPath[file.Path] = file
	}

	currentByPath := make(map[string]source.FileRecord, len(files))
	for _, file := range files {
		currentByPath[file.Path] = file
	}

	changedHours := make(map[time.Time]struct{})

	for _, knownFile := range knownFiles {
		if _, exists := currentByPath[knownFile.Path]; exists {
			continue
		}
		hours, err := e.store.DeleteSourceFile(ctx, knownFile.Path)
		if err != nil {
			e.recordError(err)
			return err
		}
		for _, hour := range hours {
			changedHours[hour.UTC()] = struct{}{}
		}
	}

	for _, file := range files {
		knownFile, exists := knownByPath[file.Path]
		if exists && knownFile.ParseStatus == "ok" && knownFile.FileSize == file.Size && knownFile.FileModTime.Equal(file.ModTime.UTC()) {
			continue
		}

		usages, _, err := parser.ParseFile(file)
		if err != nil {
			if markErr := e.store.MarkSourceFileError(ctx, file, scannedAt, err); markErr != nil {
				e.logger.Printf("failed to persist source error for %s: %v", file.Path, markErr)
			}
			e.recordError(err)
			continue
		}

		hours, err := e.store.ReplaceRequestUsage(ctx, file, usages, scannedAt)
		if err != nil {
			e.recordError(err)
			return err
		}
		for _, hour := range hours {
			changedHours[hour.UTC()] = struct{}{}
		}
	}

	if err := e.store.RebuildBuckets(ctx, sortedTimes(changedHours), scannedAt); err != nil {
		e.recordError(err)
		return err
	}
	if err := e.store.RecordScan(ctx, scannedAt); err != nil {
		e.recordError(err)
		return err
	}

	eligibleBefore := e.now().UTC().Add(-e.cfg.Sync.FinalizationDelayDur).Truncate(time.Hour)
	buckets, err := e.store.ListBucketsForExport(ctx, eligibleBefore, exportWindow, forceExport)
	if err != nil {
		e.recordError(err)
		return err
	}

	payload := make([]rollup.HourlyBucket, 0, len(buckets))
	for _, bucket := range buckets {
		payload = append(payload, bucket.HourlyBucket)
	}

	if err := e.sink.Export(ctx, payload); err != nil {
		e.recordError(err)
		return err
	}

	if err := e.store.MarkBucketsExported(ctx, buckets, e.now().UTC()); err != nil {
		e.recordError(err)
		return err
	}

	dirtyBuckets, err := e.store.ListDirtyBuckets(ctx)
	if err == nil {
		e.setDirtyBucketCount(len(dirtyBuckets))
	}
	e.setScanAt(scannedAt)
	e.setExportAt(e.now().UTC())
	e.clearError()

	return nil
}

func (e *Exporter) startHealthServer() *http.Server {
	if e.cfg.Health.ListenAddr == "" {
		return nil
	}

	server := &http.Server{
		Addr:    e.cfg.Health.ListenAddr,
		Handler: http.HandlerFunc(e.handleHealth),
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			e.logger.Printf("health server failed: %v", err)
		}
	}()

	return server
}

func (e *Exporter) handleHealth(w http.ResponseWriter, r *http.Request) {
	e.health.mu.RLock()
	defer e.health.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(e.health)
}

func RunWithSignals(run func(context.Context) error) error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	return run(ctx)
}

func MustLogger() *log.Logger {
	return log.New(os.Stdout, "claude-vm-exporter: ", log.LstdFlags|log.Lshortfile)
}

func sortedTimes(values map[time.Time]struct{}) []time.Time {
	result := make([]time.Time, 0, len(values))
	for value := range values {
		result = append(result, value.UTC())
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Before(result[j])
	})
	return result
}

func (e *Exporter) recordError(err error) {
	e.health.mu.Lock()
	defer e.health.mu.Unlock()
	e.health.LastError = err.Error()
}

func (e *Exporter) clearError() {
	e.health.mu.Lock()
	defer e.health.mu.Unlock()
	e.health.LastError = ""
}

func (e *Exporter) setScanAt(ts time.Time) {
	e.health.mu.Lock()
	defer e.health.mu.Unlock()
	e.health.LastScanAt = ts.UTC().Format(time.RFC3339)
}

func (e *Exporter) setExportAt(ts time.Time) {
	e.health.mu.Lock()
	defer e.health.mu.Unlock()
	e.health.LastExportAt = ts.UTC().Format(time.RFC3339)
}

func (e *Exporter) setDirtyBucketCount(count int) {
	e.health.mu.Lock()
	defer e.health.mu.Unlock()
	e.health.DirtyBuckets = count
}
