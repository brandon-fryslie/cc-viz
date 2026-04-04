package metrics

import (
	"bufio"
	"context"
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/brandon-fryslie/cc-viz/internal/service"
)

const (
	routeLabelUnknown = "unknown"
	subsystemHTTP     = "http"
	subsystemApp      = "app"
)

type HTTPMetrics struct {
	inFlight *prometheus.GaugeVec
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
}

func NewRegistry(storage service.RuntimeStorageService, db *sql.DB) (*prometheus.Registry, *HTTPMetrics) {
	registry := prometheus.NewRegistry()
	registry.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)

	httpMetrics := newHTTPMetrics(registry)
	registry.MustRegister(newAppCollector(storage, db, time.Now))

	return registry, httpMetrics
}

func Handler(registry *prometheus.Registry) http.Handler {
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{
		EnableOpenMetrics: true,
	})
}

func newHTTPMetrics(registerer prometheus.Registerer) *HTTPMetrics {
	metrics := &HTTPMetrics{
		inFlight: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "ccviz",
				Subsystem: subsystemHTTP,
				Name:      "in_flight_requests",
				Help:      "Current number of HTTP requests being served.",
			},
			[]string{"route"},
		),
		requests: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "ccviz",
				Subsystem: subsystemHTTP,
				Name:      "requests_total",
				Help:      "Total number of HTTP requests handled by route, method, and status.",
			},
			[]string{"route", "method", "status"},
		),
		duration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "ccviz",
				Subsystem: subsystemHTTP,
				Name:      "request_duration_seconds",
				Help:      "HTTP request duration by route, method, and status.",
				Buckets:   prometheus.DefBuckets,
			},
			[]string{"route", "method", "status"},
		),
	}

	registerer.MustRegister(metrics.inFlight, metrics.requests, metrics.duration)
	return metrics
}

func (m *HTTPMetrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		route := routeTemplate(r)
		m.inFlight.WithLabelValues(route).Inc()
		defer m.inFlight.WithLabelValues(route).Dec()

		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(recorder, r)

		route = routeTemplate(r)
		status := strconv.Itoa(recorder.statusCode)
		m.requests.WithLabelValues(route, r.Method, status).Inc()
		m.duration.WithLabelValues(route, r.Method, status).Observe(time.Since(start).Seconds())
	})
}

type appCollector struct {
	storage service.RuntimeStorageService
	db      *sql.DB
	now     func() time.Time

	dbUp                 *prometheus.Desc
	subsystemSuccess     *prometheus.Desc
	sessionStats         *prometheus.Desc
	sessionMessages      *prometheus.Desc
	extensionTotal       *prometheus.Desc
	extensionsByType     *prometheus.Desc
	pluginEnabled        *prometheus.Desc
	pluginDisabled       *prometheus.Desc
	subagentStats        *prometheus.Desc
	subagentAvgPerParent *prometheus.Desc
	windowTotals         *prometheus.Desc
	modelStats           *prometheus.Desc
	datasetCounts        *prometheus.Desc
	todoStatusCounts     *prometheus.Desc
	lastUpdated          *prometheus.Desc
	lagSeconds           *prometheus.Desc
}

func newAppCollector(storage service.RuntimeStorageService, db *sql.DB, now func() time.Time) prometheus.Collector {
	return &appCollector{
		storage: storage,
		db:      db,
		now:     now,
		dbUp: prometheus.NewDesc(
			"ccviz_app_database_up",
			"Whether the application database is reachable.",
			nil,
			nil,
		),
		subsystemSuccess: prometheus.NewDesc(
			"ccviz_app_scrape_success",
			"Whether a subsystem scrape completed successfully.",
			[]string{"subsystem"},
			nil,
		),
		sessionStats: prometheus.NewDesc(
			"ccviz_app_sessions",
			"Session counts by kind.",
			[]string{"kind"},
			nil,
		),
		sessionMessages: prometheus.NewDesc(
			"ccviz_app_session_messages_total",
			"Total number of messages across all indexed sessions.",
			nil,
			nil,
		),
		extensionTotal: prometheus.NewDesc(
			"ccviz_app_extensions_total",
			"Total number of indexed extensions.",
			nil,
			nil,
		),
		extensionsByType: prometheus.NewDesc(
			"ccviz_app_extensions_by_type",
			"Indexed extensions grouped by type.",
			[]string{"type"},
			nil,
		),
		pluginEnabled: prometheus.NewDesc(
			"ccviz_app_enabled_plugins_total",
			"Total number of enabled plugins.",
			nil,
			nil,
		),
		pluginDisabled: prometheus.NewDesc(
			"ccviz_app_disabled_plugins_total",
			"Total number of disabled plugins.",
			nil,
			nil,
		),
		subagentStats: prometheus.NewDesc(
			"ccviz_app_subagents",
			"Subagent graph aggregates by kind.",
			[]string{"kind"},
			nil,
		),
		subagentAvgPerParent: prometheus.NewDesc(
			"ccviz_app_subagent_avg_agents_per_session",
			"Average number of subagents per session.",
			nil,
			nil,
		),
		windowTotals: prometheus.NewDesc(
			"ccviz_app_window_total",
			"Windowed aggregate totals for requests and tokens.",
			[]string{"window", "kind"},
			nil,
		),
		modelStats: prometheus.NewDesc(
			"ccviz_app_model_window_total",
			"Model aggregates over the configured time window.",
			[]string{"window", "model", "kind"},
			nil,
		),
		datasetCounts: prometheus.NewDesc(
			"ccviz_app_dataset_total",
			"Total rows stored for each canonical dataset.",
			[]string{"dataset"},
			nil,
		),
		todoStatusCounts: prometheus.NewDesc(
			"ccviz_app_todos_by_status",
			"Todo rows grouped by status.",
			[]string{"status"},
			nil,
		),
		lastUpdated: prometheus.NewDesc(
			"ccviz_app_dataset_last_update_timestamp_seconds",
			"Unix timestamp for the latest update/index event per dataset.",
			[]string{"dataset"},
			nil,
		),
		lagSeconds: prometheus.NewDesc(
			"ccviz_app_dataset_lag_seconds",
			"Age in seconds since the latest update/index event per dataset.",
			[]string{"dataset"},
			nil,
		),
	}
}

func (c *appCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.dbUp
	ch <- c.subsystemSuccess
	ch <- c.sessionStats
	ch <- c.sessionMessages
	ch <- c.extensionTotal
	ch <- c.extensionsByType
	ch <- c.pluginEnabled
	ch <- c.pluginDisabled
	ch <- c.subagentStats
	ch <- c.subagentAvgPerParent
	ch <- c.windowTotals
	ch <- c.modelStats
	ch <- c.datasetCounts
	ch <- c.todoStatusCounts
	ch <- c.lastUpdated
	ch <- c.lagSeconds
}

func (c *appCollector) Collect(ch chan<- prometheus.Metric) {
	// [LAW:dataflow-not-control-flow] Run the same subsystem collectors on every scrape;
	// missing data changes success/value metrics instead of changing which collectors execute.
	collectors := []func(chan<- prometheus.Metric){
		c.collectDatabaseHealth,
		c.collectSessionStats,
		c.collectExtensionStats,
		c.collectSubagentStats,
		c.collectWindowStats,
		c.collectModelStats,
		c.collectDBStats,
	}

	for _, collect := range collectors {
		collect(ch)
	}
}

func (c *appCollector) collectDatabaseHealth(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	dbUp := 0.0
	if c.db != nil && c.db.PingContext(ctx) == nil {
		dbUp = 1
	}

	ch <- prometheus.MustNewConstMetric(c.dbUp, prometheus.GaugeValue, dbUp)
}

func (c *appCollector) collectSessionStats(ch chan<- prometheus.Metric) {
	stats, err := c.storage.GetSessionStats()
	c.emitSuccess(ch, "sessions", err == nil)
	if err != nil {
		return
	}

	ch <- prometheus.MustNewConstMetric(c.sessionStats, prometheus.GaugeValue, float64(stats.TotalSessions), "total")
	ch <- prometheus.MustNewConstMetric(c.sessionStats, prometheus.GaugeValue, float64(stats.ActiveSessions), "active")
	ch <- prometheus.MustNewConstMetric(c.sessionStats, prometheus.GaugeValue, float64(stats.UniqueProjects), "unique_projects")
	ch <- prometheus.MustNewConstMetric(c.sessionMessages, prometheus.GaugeValue, float64(stats.TotalMessages))
}

func (c *appCollector) collectExtensionStats(ch chan<- prometheus.Metric) {
	stats, err := c.storage.GetExtensionStats()
	c.emitSuccess(ch, "extensions", err == nil)
	if err != nil {
		return
	}

	ch <- prometheus.MustNewConstMetric(c.extensionTotal, prometheus.GaugeValue, float64(stats.Stats.Total))
	ch <- prometheus.MustNewConstMetric(c.pluginEnabled, prometheus.GaugeValue, float64(len(stats.Stats.EnabledPlugins)))
	ch <- prometheus.MustNewConstMetric(c.pluginDisabled, prometheus.GaugeValue, float64(len(stats.Stats.DisabledPlugins)))

	for extType, total := range stats.Stats.ByType {
		ch <- prometheus.MustNewConstMetric(c.extensionsByType, prometheus.GaugeValue, float64(total), extType)
	}
}

func (c *appCollector) collectSubagentStats(ch chan<- prometheus.Metric) {
	stats, err := c.storage.GetSubagentGraphStats()
	c.emitSuccess(ch, "subagents", err == nil)
	if err != nil {
		return
	}

	ch <- prometheus.MustNewConstMetric(c.subagentStats, prometheus.GaugeValue, float64(stats.TotalSessions), "sessions")
	ch <- prometheus.MustNewConstMetric(c.subagentStats, prometheus.GaugeValue, float64(stats.TotalAgents), "agents")
	ch <- prometheus.MustNewConstMetric(c.subagentStats, prometheus.GaugeValue, float64(stats.TotalRootAgents), "root_agents")
	ch <- prometheus.MustNewConstMetric(c.subagentStats, prometheus.GaugeValue, float64(stats.TotalSidechains), "sidechains")
	ch <- prometheus.MustNewConstMetric(c.subagentStats, prometheus.GaugeValue, float64(stats.MaxDepth), "max_depth")
	ch <- prometheus.MustNewConstMetric(c.subagentAvgPerParent, prometheus.GaugeValue, stats.AvgAgentsPerSession)
}

func (c *appCollector) collectWindowStats(ch chan<- prometheus.Metric) {
	end := c.now().UTC()
	start := end.AddDate(0, 0, -7)

	stats, err := c.storage.GetStats(start.Format(time.RFC3339), end.Format(time.RFC3339))
	c.emitSuccess(ch, "window_7d", err == nil)
	if err != nil {
		return
	}

	var totalTokens int64
	var totalRequests int
	for _, day := range stats.DailyStats {
		totalTokens += day.Tokens
		totalRequests += day.Requests
	}

	ch <- prometheus.MustNewConstMetric(c.windowTotals, prometheus.GaugeValue, float64(totalTokens), "7d", "tokens")
	ch <- prometheus.MustNewConstMetric(c.windowTotals, prometheus.GaugeValue, float64(totalRequests), "7d", "requests")
	ch <- prometheus.MustNewConstMetric(c.windowTotals, prometheus.GaugeValue, float64(len(stats.DailyStats)), "7d", "days")
}

func (c *appCollector) collectModelStats(ch chan<- prometheus.Metric) {
	end := c.now().UTC()
	start := end.AddDate(0, 0, -30)

	stats, err := c.storage.GetModelStats(start.Format(time.RFC3339), end.Format(time.RFC3339))
	c.emitSuccess(ch, "models_30d", err == nil)
	if err != nil {
		return
	}

	for _, modelStats := range stats.ModelStats {
		ch <- prometheus.MustNewConstMetric(c.modelStats, prometheus.GaugeValue, float64(modelStats.Tokens), "30d", modelStats.Model, "tokens")
		ch <- prometheus.MustNewConstMetric(c.modelStats, prometheus.GaugeValue, float64(modelStats.Requests), "30d", modelStats.Model, "requests")
	}
}

func (c *appCollector) collectDBStats(ch chan<- prometheus.Metric) {
	c.emitSuccess(ch, "datasets", c.db != nil)
	if c.db == nil {
		return
	}

	// [LAW:one-source-of-truth] Dataset counts and freshness come directly from the canonical
	// persisted tables instead of shadow counters that could drift from storage state.
	countQueries := []struct {
		dataset string
		query   string
	}{
		{dataset: "conversations", query: "SELECT COUNT(*) FROM conversations"},
		{dataset: "conversation_messages", query: "SELECT COUNT(*) FROM conversation_messages"},
		{dataset: "requests", query: "SELECT COUNT(*) FROM requests"},
		{dataset: "todos", query: "SELECT COUNT(*) FROM claude_todos"},
		{dataset: "todo_sessions", query: "SELECT COUNT(*) FROM claude_todo_sessions"},
		{dataset: "plans", query: "SELECT COUNT(*) FROM claude_plans"},
	}

	for _, item := range countQueries {
		var total int64
		if err := c.db.QueryRow(item.query).Scan(&total); err == nil {
			ch <- prometheus.MustNewConstMetric(c.datasetCounts, prometheus.GaugeValue, float64(total), item.dataset)
		}
	}

	rows, err := c.db.Query("SELECT status, COUNT(*) FROM claude_todos GROUP BY status")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var total int64
			if scanErr := rows.Scan(&status, &total); scanErr == nil {
				ch <- prometheus.MustNewConstMetric(c.todoStatusCounts, prometheus.GaugeValue, float64(total), status)
			}
		}
	}

	timestampQueries := []struct {
		dataset string
		query   string
	}{
		{dataset: "conversations", query: "SELECT MAX(indexed_at) FROM conversations"},
		{dataset: "todos", query: "SELECT MAX(indexed_at) FROM claude_todos"},
		{dataset: "todo_sessions", query: "SELECT MAX(indexed_at) FROM claude_todo_sessions"},
		{dataset: "plans", query: "SELECT MAX(indexed_at) FROM claude_plans"},
		{dataset: "subagents", query: "SELECT MAX(indexed_at) FROM subagent_graph"},
		{dataset: "extensions", query: "SELECT MAX(updated_at) FROM extensions"},
	}

	now := c.now().UTC()
	for _, item := range timestampQueries {
		var ts sql.NullString
		if err := c.db.QueryRow(item.query).Scan(&ts); err != nil || !ts.Valid || ts.String == "" {
			continue
		}

		parsed, parseErr := parseTimestamp(ts.String)
		if parseErr != nil {
			continue
		}

		ch <- prometheus.MustNewConstMetric(c.lastUpdated, prometheus.GaugeValue, float64(parsed.Unix()), item.dataset)
		ch <- prometheus.MustNewConstMetric(c.lagSeconds, prometheus.GaugeValue, now.Sub(parsed).Seconds(), item.dataset)
	}
}

func (c *appCollector) emitSuccess(ch chan<- prometheus.Metric, subsystem string, ok bool) {
	value := 0.0
	if ok {
		value = 1
	}
	ch <- prometheus.MustNewConstMetric(c.subsystemSuccess, prometheus.GaugeValue, value, subsystem)
}

func routeTemplate(r *http.Request) string {
	route := mux.CurrentRoute(r)
	if route == nil {
		return routeLabelUnknown
	}

	path, err := route.GetPathTemplate()
	if err == nil && path != "" {
		return path
	}

	name := route.GetName()
	if name != "" {
		return name
	}

	return routeLabelUnknown
}

func parseTimestamp(value string) (time.Time, error) {
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
	}

	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UTC(), nil
		}
	}

	return time.Time{}, fmt.Errorf("unsupported timestamp format %q", value)
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("wrapped response writer does not implement http.Hijacker")
	}
	return hijacker.Hijack()
}

func (r *statusRecorder) Flush() {
	if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (r *statusRecorder) Push(target string, opts *http.PushOptions) error {
	if pusher, ok := r.ResponseWriter.(http.Pusher); ok {
		return pusher.Push(target, opts)
	}
	return http.ErrNotSupported
}
