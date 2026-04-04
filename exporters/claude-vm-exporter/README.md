# Claude VM Exporter

Standalone exporter that reads Claude Code conversation JSONL files from disk,
derives hourly usage buckets, and writes timestamped samples to VictoriaMetrics.

## Run

```bash
cd exporters/claude-vm-exporter
go run ./cmd/claude-vm-exporter serve -config ./config.example.yaml
```

## Backfill

```bash
cd exporters/claude-vm-exporter
go run ./cmd/claude-vm-exporter backfill \
  -config ./config.example.yaml \
  -from 2026-04-01T00:00:00Z \
  -to 2026-04-04T00:00:00Z
```
