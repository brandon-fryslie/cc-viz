package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/app"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/config"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/sink/victoriametrics"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/state"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return errors.New("expected subcommand: serve or backfill")
	}

	switch args[0] {
	case "serve":
		return runServe(args[1:])
	case "backfill":
		return runBackfill(args[1:])
	default:
		return fmt.Errorf("unknown subcommand %q", args[0])
	}
}

func runServe(args []string) error {
	fs := flag.NewFlagSet("serve", flag.ContinueOnError)
	configPath := fs.String("config", "", "Path to exporter config file")
	if err := fs.Parse(args); err != nil {
		return err
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		return err
	}

	store, err := state.Open(cfg.State.DBPath)
	if err != nil {
		return err
	}
	defer store.Close()

	exporter := app.New(
		cfg,
		store,
		victoriametrics.New(victoriametrics.Config{
			WriteURL:          cfg.VictoriaMetrics.WriteURL,
			BearerToken:       cfg.VictoriaMetrics.Auth.BearerToken,
			BasicAuthUser:     cfg.VictoriaMetrics.Auth.BasicAuthUser,
			BasicAuthPassword: cfg.VictoriaMetrics.Auth.BasicAuthPassword,
			Timeout:           cfg.VictoriaMetrics.TimeoutDur,
			StaticLabels:      cfg.Labels.Static,
		}),
		app.MustLogger(),
	)

	return app.RunWithSignals(exporter.RunServe)
}

func runBackfill(args []string) error {
	fs := flag.NewFlagSet("backfill", flag.ContinueOnError)
	configPath := fs.String("config", "", "Path to exporter config file")
	fromValue := fs.String("from", "", "Inclusive UTC lower bound, RFC3339 or YYYY-MM-DD")
	toValue := fs.String("to", "", "Exclusive UTC upper bound, RFC3339 or YYYY-MM-DD")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if *fromValue == "" || *toValue == "" {
		return errors.New("backfill requires -from and -to")
	}

	from, err := parseBound(*fromValue)
	if err != nil {
		return fmt.Errorf("invalid -from: %w", err)
	}
	to, err := parseBound(*toValue)
	if err != nil {
		return fmt.Errorf("invalid -to: %w", err)
	}
	if !from.Before(to) {
		return errors.New("-from must be before -to")
	}

	cfg, err := config.Load(*configPath)
	if err != nil {
		return err
	}

	store, err := state.Open(cfg.State.DBPath)
	if err != nil {
		return err
	}
	defer store.Close()

	exporter := app.New(
		cfg,
		store,
		victoriametrics.New(victoriametrics.Config{
			WriteURL:          cfg.VictoriaMetrics.WriteURL,
			BearerToken:       cfg.VictoriaMetrics.Auth.BearerToken,
			BasicAuthUser:     cfg.VictoriaMetrics.Auth.BasicAuthUser,
			BasicAuthPassword: cfg.VictoriaMetrics.Auth.BasicAuthPassword,
			Timeout:           cfg.VictoriaMetrics.TimeoutDur,
			StaticLabels:      cfg.Labels.Static,
		}),
		app.MustLogger(),
	)

	return app.RunWithSignals(func(ctx context.Context) error {
		return exporter.RunBackfill(ctx, from, to)
	})
}

func parseBound(value string) (time.Time, error) {
	layouts := []string{time.RFC3339Nano, time.RFC3339, "2006-01-02"}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported time format %q", value)
}
