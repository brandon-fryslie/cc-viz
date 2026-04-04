package state

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/rollup"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/source"
)

type Store struct {
	db *sql.DB
}

type SourceFile struct {
	Path          string
	SessionID     string
	Project       string
	FileModTime   time.Time
	FileSize      int64
	LastScannedAt time.Time
	ParseStatus   string
	ParseError    string
}

type BucketRecord struct {
	rollup.HourlyBucket
	Finalized    bool
	Dirty        bool
	Hash         string
	ExportedHash sql.NullString
	ExportedAt   sql.NullString
}

func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	// [LAW:one-source-of-truth] The exporter-owned SQLite DB is the only mutable
	// coordination state for scans, rollups, and export progress.
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=30000&_synchronous=NORMAL")
	if err != nil {
		return nil, err
	}

	store := &Store{db: db}
	if err := store.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}

	return store, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) ListSourceFiles(ctx context.Context) ([]SourceFile, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT path, session_id, project, file_mtime, file_size, last_scanned_at, parse_status, parse_error
		FROM source_files
		ORDER BY path
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := make([]SourceFile, 0)
	for rows.Next() {
		var file SourceFile
		var modTime, scannedAt string
		if err := rows.Scan(
			&file.Path,
			&file.SessionID,
			&file.Project,
			&modTime,
			&file.FileSize,
			&scannedAt,
			&file.ParseStatus,
			&file.ParseError,
		); err != nil {
			return nil, err
		}

		file.FileModTime, err = time.Parse(time.RFC3339, modTime)
		if err != nil {
			return nil, err
		}
		file.LastScannedAt, err = time.Parse(time.RFC3339, scannedAt)
		if err != nil {
			return nil, err
		}

		files = append(files, file)
	}

	return files, rows.Err()
}

func (s *Store) ReplaceRequestUsage(ctx context.Context, file source.FileRecord, usages []rollup.RequestUsage, scannedAt time.Time) ([]time.Time, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	affectedHours, err := selectAffectedHours(ctx, tx, file.Path)
	if err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM request_usage WHERE source_path = ?`, file.Path); err != nil {
		return nil, err
	}

	if err := upsertSourceFile(ctx, tx, file, scannedAt, "ok", ""); err != nil {
		return nil, err
	}

	for _, usage := range usages {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO request_usage (
				source_path, session_id, project, request_key, model, hour_start_utc, first_seen_at,
				input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			usage.SourcePath,
			usage.SessionID,
			usage.Project,
			usage.RequestKey,
			usage.Model,
			usage.HourStartUTC.UTC().Format(time.RFC3339),
			usage.FirstSeenAt.UTC().Format(time.RFC3339),
			usage.InputTokens,
			usage.OutputTokens,
			usage.CacheReadTokens,
			usage.CacheCreationTokens,
		); err != nil {
			return nil, err
		}
		affectedHours[usage.HourStartUTC.UTC()] = struct{}{}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return sortedHours(affectedHours), nil
}

func (s *Store) MarkSourceFileError(ctx context.Context, file source.FileRecord, scannedAt time.Time, parseErr error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := upsertSourceFile(ctx, tx, file, scannedAt, "error", parseErr.Error()); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) DeleteSourceFile(ctx context.Context, path string) ([]time.Time, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	affectedHours, err := selectAffectedHours(ctx, tx, path)
	if err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM request_usage WHERE source_path = ?`, path); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM source_files WHERE path = ?`, path); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return sortedHours(affectedHours), nil
}

func (s *Store) RebuildBuckets(ctx context.Context, hours []time.Time, now time.Time) error {
	if len(hours) == 0 {
		return nil
	}

	uniqueHours := make(map[time.Time]struct{}, len(hours))
	for _, hour := range hours {
		uniqueHours[hour.UTC()] = struct{}{}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, hour := range sortedHours(uniqueHours) {
		if err := s.rebuildHour(ctx, tx, hour.UTC(), now.UTC()); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) ListBucketsForExport(ctx context.Context, eligibleBefore time.Time, window *TimeWindow, force bool) ([]BucketRecord, error) {
	query := `
		SELECT
			hour_start_utc, project, model, requests, input_tokens, output_tokens,
			cache_read_tokens, cache_creation_tokens, total_tokens, finalized, dirty, hash, exported_hash, exported_at
		FROM hourly_buckets
		WHERE hour_start_utc < ?
	`
	args := []interface{}{eligibleBefore.UTC().Format(time.RFC3339)}

	if window != nil {
		query += ` AND hour_start_utc >= ? AND hour_start_utc < ?`
		args = append(args, window.From.UTC().Format(time.RFC3339), window.To.UTC().Format(time.RFC3339))
	}

	if !force {
		query += ` AND dirty = 0 AND exported_hash IS NULL`
	}

	query += ` ORDER BY hour_start_utc, project, model`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	buckets := make([]BucketRecord, 0)
	for rows.Next() {
		var bucket BucketRecord
		var hour string
		var finalized, dirty int
		if err := rows.Scan(
			&hour,
			&bucket.Project,
			&bucket.Model,
			&bucket.Requests,
			&bucket.InputTokens,
			&bucket.OutputTokens,
			&bucket.CacheReadTokens,
			&bucket.CacheCreationTokens,
			&bucket.TotalTokens,
			&finalized,
			&dirty,
			&bucket.Hash,
			&bucket.ExportedHash,
			&bucket.ExportedAt,
		); err != nil {
			return nil, err
		}

		bucket.HourStartUTC, err = time.Parse(time.RFC3339, hour)
		if err != nil {
			return nil, err
		}
		bucket.Finalized = finalized == 1
		bucket.Dirty = dirty == 1
		buckets = append(buckets, bucket)
	}

	return buckets, rows.Err()
}

func (s *Store) MarkBucketsExported(ctx context.Context, buckets []BucketRecord, exportedAt time.Time) error {
	if len(buckets) == 0 {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, bucket := range buckets {
		if _, err := tx.ExecContext(ctx, `
			UPDATE hourly_buckets
			SET finalized = 1, dirty = 0, exported_hash = hash, exported_at = ?, updated_at = ?
			WHERE hour_start_utc = ? AND project = ? AND model = ?
		`,
			exportedAt.UTC().Format(time.RFC3339),
			exportedAt.UTC().Format(time.RFC3339),
			bucket.HourStartUTC.UTC().Format(time.RFC3339),
			bucket.Project,
			bucket.Model,
		); err != nil {
			return err
		}
	}

	if err := s.SetState(ctx, tx, "last_successful_export_at", exportedAt.UTC().Format(time.RFC3339)); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) RecordScan(ctx context.Context, scannedAt time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := s.SetState(ctx, tx, "last_scan_at", scannedAt.UTC().Format(time.RFC3339)); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) ListDirtyBuckets(ctx context.Context) ([]BucketRecord, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			hour_start_utc, project, model, requests, input_tokens, output_tokens,
			cache_read_tokens, cache_creation_tokens, total_tokens, finalized, dirty, hash, exported_hash, exported_at
		FROM hourly_buckets
		WHERE dirty = 1
		ORDER BY hour_start_utc, project, model
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	buckets := make([]BucketRecord, 0)
	for rows.Next() {
		var bucket BucketRecord
		var hour string
		var finalized, dirty int
		if err := rows.Scan(
			&hour,
			&bucket.Project,
			&bucket.Model,
			&bucket.Requests,
			&bucket.InputTokens,
			&bucket.OutputTokens,
			&bucket.CacheReadTokens,
			&bucket.CacheCreationTokens,
			&bucket.TotalTokens,
			&finalized,
			&dirty,
			&bucket.Hash,
			&bucket.ExportedHash,
			&bucket.ExportedAt,
		); err != nil {
			return nil, err
		}
		bucket.HourStartUTC, err = time.Parse(time.RFC3339, hour)
		if err != nil {
			return nil, err
		}
		bucket.Finalized = finalized == 1
		bucket.Dirty = dirty == 1
		buckets = append(buckets, bucket)
	}

	return buckets, rows.Err()
}

type TimeWindow struct {
	From time.Time
	To   time.Time
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS source_files (
		path TEXT PRIMARY KEY,
		session_id TEXT NOT NULL,
		project TEXT NOT NULL,
		file_mtime TEXT NOT NULL,
		file_size INTEGER NOT NULL,
		last_scanned_at TEXT NOT NULL,
		parse_status TEXT NOT NULL,
		parse_error TEXT NOT NULL DEFAULT ''
	);

	CREATE TABLE IF NOT EXISTS request_usage (
		source_path TEXT NOT NULL,
		session_id TEXT NOT NULL,
		project TEXT NOT NULL,
		request_key TEXT NOT NULL,
		model TEXT NOT NULL,
		hour_start_utc TEXT NOT NULL,
		first_seen_at TEXT NOT NULL,
		input_tokens INTEGER NOT NULL,
		output_tokens INTEGER NOT NULL,
		cache_read_tokens INTEGER NOT NULL,
		cache_creation_tokens INTEGER NOT NULL,
		PRIMARY KEY (source_path, request_key)
	);

	CREATE TABLE IF NOT EXISTS hourly_buckets (
		hour_start_utc TEXT NOT NULL,
		project TEXT NOT NULL,
		model TEXT NOT NULL,
		requests INTEGER NOT NULL,
		input_tokens INTEGER NOT NULL,
		output_tokens INTEGER NOT NULL,
		cache_read_tokens INTEGER NOT NULL,
		cache_creation_tokens INTEGER NOT NULL,
		total_tokens INTEGER NOT NULL,
		finalized INTEGER NOT NULL DEFAULT 0,
		dirty INTEGER NOT NULL DEFAULT 0,
		hash TEXT NOT NULL,
		exported_hash TEXT,
		exported_at TEXT,
		updated_at TEXT NOT NULL,
		PRIMARY KEY (hour_start_utc, project, model)
	);

	CREATE TABLE IF NOT EXISTS export_state (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_request_usage_hour ON request_usage(hour_start_utc);
	CREATE INDEX IF NOT EXISTS idx_request_usage_source ON request_usage(source_path);
	CREATE INDEX IF NOT EXISTS idx_hourly_buckets_export ON hourly_buckets(dirty, exported_hash, hour_start_utc);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *Store) rebuildHour(ctx context.Context, tx *sql.Tx, hour time.Time, now time.Time) error {
	existing, err := loadExistingBuckets(ctx, tx, hour)
	if err != nil {
		return err
	}

	usages, err := loadUsagesForHour(ctx, tx, hour)
	if err != nil {
		return err
	}
	fresh := rollup.Aggregate(usages)

	freshByKey := make(map[string]rollup.HourlyBucket, len(fresh))
	for _, bucket := range fresh {
		freshByKey[bucketIdentity(bucket)] = bucket
	}

	for key, bucket := range freshByKey {
		hash := rollup.HashBucket(bucket)
		if existingBucket, ok := existing[key]; ok {
			finalized := existingBucket.Finalized
			dirty := existingBucket.Dirty
			exportedHash := existingBucket.ExportedHash
			exportedAt := existingBucket.ExportedAt
			if finalized && (!exportedHash.Valid || exportedHash.String != hash) {
				dirty = true
			}
			if err := upsertBucket(ctx, tx, bucket, hash, finalized, dirty, exportedHash, exportedAt, now); err != nil {
				return err
			}
			delete(existing, key)
			continue
		}

		if err := upsertBucket(ctx, tx, bucket, hash, false, false, sql.NullString{}, sql.NullString{}, now); err != nil {
			return err
		}
	}

	for _, staleBucket := range existing {
		if staleBucket.Finalized {
			zeroBucket := rollup.HourlyBucket{
				HourStartUTC:        staleBucket.HourStartUTC,
				Project:             staleBucket.Project,
				Model:               staleBucket.Model,
				Requests:            0,
				InputTokens:         0,
				OutputTokens:        0,
				CacheReadTokens:     0,
				CacheCreationTokens: 0,
				TotalTokens:         0,
			}
			if err := upsertBucket(ctx, tx, zeroBucket, rollup.HashBucket(zeroBucket), true, true, staleBucket.ExportedHash, staleBucket.ExportedAt, now); err != nil {
				return err
			}
			continue
		}

		if _, err := tx.ExecContext(ctx, `
			DELETE FROM hourly_buckets WHERE hour_start_utc = ? AND project = ? AND model = ?
		`,
			staleBucket.HourStartUTC.UTC().Format(time.RFC3339),
			staleBucket.Project,
			staleBucket.Model,
		); err != nil {
			return err
		}
	}

	return nil
}

func loadExistingBuckets(ctx context.Context, tx *sql.Tx, hour time.Time) (map[string]BucketRecord, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT hour_start_utc, project, model, requests, input_tokens, output_tokens,
		       cache_read_tokens, cache_creation_tokens, total_tokens, finalized, dirty, hash, exported_hash, exported_at
		FROM hourly_buckets
		WHERE hour_start_utc = ?
	`,
		hour.UTC().Format(time.RFC3339),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	existing := make(map[string]BucketRecord)
	for rows.Next() {
		var bucket BucketRecord
		var hourText string
		var finalized, dirty int
		if err := rows.Scan(
			&hourText,
			&bucket.Project,
			&bucket.Model,
			&bucket.Requests,
			&bucket.InputTokens,
			&bucket.OutputTokens,
			&bucket.CacheReadTokens,
			&bucket.CacheCreationTokens,
			&bucket.TotalTokens,
			&finalized,
			&dirty,
			&bucket.Hash,
			&bucket.ExportedHash,
			&bucket.ExportedAt,
		); err != nil {
			return nil, err
		}

		parsedHour, err := time.Parse(time.RFC3339, hourText)
		if err != nil {
			return nil, err
		}

		bucket.HourStartUTC = parsedHour.UTC()
		bucket.Finalized = finalized == 1
		bucket.Dirty = dirty == 1
		existing[bucketIdentity(bucket.HourlyBucket)] = bucket
	}

	return existing, rows.Err()
}

func loadUsagesForHour(ctx context.Context, tx *sql.Tx, hour time.Time) ([]rollup.RequestUsage, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT source_path, session_id, project, request_key, model, hour_start_utc, first_seen_at,
		       input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
		FROM request_usage
		WHERE hour_start_utc = ?
	`,
		hour.UTC().Format(time.RFC3339),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	usages := make([]rollup.RequestUsage, 0)
	for rows.Next() {
		var usage rollup.RequestUsage
		var hourText, firstSeen string
		if err := rows.Scan(
			&usage.SourcePath,
			&usage.SessionID,
			&usage.Project,
			&usage.RequestKey,
			&usage.Model,
			&hourText,
			&firstSeen,
			&usage.InputTokens,
			&usage.OutputTokens,
			&usage.CacheReadTokens,
			&usage.CacheCreationTokens,
		); err != nil {
			return nil, err
		}

		var err error
		usage.HourStartUTC, err = time.Parse(time.RFC3339, hourText)
		if err != nil {
			return nil, err
		}
		usage.FirstSeenAt, err = time.Parse(time.RFC3339, firstSeen)
		if err != nil {
			return nil, err
		}

		usages = append(usages, usage)
	}

	return usages, rows.Err()
}

func upsertBucket(ctx context.Context, tx *sql.Tx, bucket rollup.HourlyBucket, hash string, finalized, dirty bool, exportedHash, exportedAt sql.NullString, now time.Time) error {
	finalizedInt := 0
	if finalized {
		finalizedInt = 1
	}
	dirtyInt := 0
	if dirty {
		dirtyInt = 1
	}

	_, err := tx.ExecContext(ctx, `
		INSERT INTO hourly_buckets (
			hour_start_utc, project, model, requests, input_tokens, output_tokens,
			cache_read_tokens, cache_creation_tokens, total_tokens, finalized, dirty,
			hash, exported_hash, exported_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(hour_start_utc, project, model) DO UPDATE SET
			requests = excluded.requests,
			input_tokens = excluded.input_tokens,
			output_tokens = excluded.output_tokens,
			cache_read_tokens = excluded.cache_read_tokens,
			cache_creation_tokens = excluded.cache_creation_tokens,
			total_tokens = excluded.total_tokens,
			finalized = excluded.finalized,
			dirty = excluded.dirty,
			hash = excluded.hash,
			exported_hash = excluded.exported_hash,
			exported_at = excluded.exported_at,
			updated_at = excluded.updated_at
	`,
		bucket.HourStartUTC.UTC().Format(time.RFC3339),
		bucket.Project,
		bucket.Model,
		bucket.Requests,
		bucket.InputTokens,
		bucket.OutputTokens,
		bucket.CacheReadTokens,
		bucket.CacheCreationTokens,
		bucket.TotalTokens,
		finalizedInt,
		dirtyInt,
		hash,
		nullStringValue(exportedHash),
		nullStringValue(exportedAt),
		now.UTC().Format(time.RFC3339),
	)
	return err
}

func selectAffectedHours(ctx context.Context, tx *sql.Tx, path string) (map[time.Time]struct{}, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT DISTINCT hour_start_utc
		FROM request_usage
		WHERE source_path = ?
	`, path)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hours := make(map[time.Time]struct{})
	for rows.Next() {
		var hourText string
		if err := rows.Scan(&hourText); err != nil {
			return nil, err
		}
		hour, err := time.Parse(time.RFC3339, hourText)
		if err != nil {
			return nil, err
		}
		hours[hour.UTC()] = struct{}{}
	}
	return hours, rows.Err()
}

func upsertSourceFile(ctx context.Context, tx *sql.Tx, file source.FileRecord, scannedAt time.Time, status, parseError string) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO source_files (
			path, session_id, project, file_mtime, file_size, last_scanned_at, parse_status, parse_error
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(path) DO UPDATE SET
			session_id = excluded.session_id,
			project = excluded.project,
			file_mtime = excluded.file_mtime,
			file_size = excluded.file_size,
			last_scanned_at = excluded.last_scanned_at,
			parse_status = excluded.parse_status,
			parse_error = excluded.parse_error
	`,
		file.Path,
		file.SessionID,
		file.Project,
		file.ModTime.UTC().Format(time.RFC3339),
		file.Size,
		scannedAt.UTC().Format(time.RFC3339),
		status,
		parseError,
	)
	return err
}

func (s *Store) SetState(ctx context.Context, tx *sql.Tx, key, value string) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO export_state (key, value, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			updated_at = excluded.updated_at
	`, key, value, time.Now().UTC().Format(time.RFC3339))
	return err
}

func bucketIdentity(bucket rollup.HourlyBucket) string {
	return strings.Join([]string{
		bucket.HourStartUTC.UTC().Format(time.RFC3339),
		bucket.Project,
		bucket.Model,
	}, "|")
}

func sortedHours(hours map[time.Time]struct{}) []time.Time {
	result := make([]time.Time, 0, len(hours))
	for hour := range hours {
		result = append(result, hour.UTC())
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Before(result[j])
	})
	return result
}

func nullStringValue(value sql.NullString) interface{} {
	if value.Valid {
		return value.String
	}
	return nil
}
