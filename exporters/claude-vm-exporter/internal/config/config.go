package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Source          SourceConfig          `yaml:"source"`
	State           StateConfig           `yaml:"state"`
	VictoriaMetrics VictoriaMetricsConfig `yaml:"victoriametrics"`
	Sync            SyncConfig            `yaml:"sync"`
	Labels          LabelsConfig          `yaml:"labels"`
	Health          HealthConfig          `yaml:"health"`
}

type SourceConfig struct {
	ProjectsDir string `yaml:"projects_dir"`
}

type StateConfig struct {
	DBPath string `yaml:"db_path"`
}

type VictoriaMetricsConfig struct {
	WriteURL   string              `yaml:"write_url"`
	BaseURL    string              `yaml:"base_url"`
	ImportPath string              `yaml:"import_path"`
	Timeout    string              `yaml:"timeout"`
	Auth       VictoriaMetricsAuth `yaml:"auth"`
	TimeoutDur time.Duration       `yaml:"-"`
}

type VictoriaMetricsAuth struct {
	BearerToken       string `yaml:"bearer_token"`
	BasicAuthUser     string `yaml:"basic_auth_user"`
	BasicAuthPassword string `yaml:"basic_auth_password"`
}

type SyncConfig struct {
	PollInterval         string        `yaml:"poll_interval"`
	FinalizationDelay    string        `yaml:"finalization_delay"`
	PollIntervalDur      time.Duration `yaml:"-"`
	FinalizationDelayDur time.Duration `yaml:"-"`
}

type LabelsConfig struct {
	Static map[string]string `yaml:"static"`
}

type HealthConfig struct {
	ListenAddr string `yaml:"listen_addr"`
}

func Load(path string) (*Config, error) {
	cfg := defaultConfig()

	if path != "" {
		content, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		if err := yaml.Unmarshal(content, cfg); err != nil {
			return nil, err
		}
	}

	applyEnvOverrides(cfg)

	var err error
	cfg.Source.ProjectsDir, err = expandPath(cfg.Source.ProjectsDir)
	if err != nil {
		return nil, err
	}
	cfg.State.DBPath, err = expandPath(cfg.State.DBPath)
	if err != nil {
		return nil, err
	}

	cfg.VictoriaMetrics.TimeoutDur, err = time.ParseDuration(cfg.VictoriaMetrics.Timeout)
	if err != nil {
		return nil, fmt.Errorf("invalid victoriametrics.timeout: %w", err)
	}
	cfg.Sync.PollIntervalDur, err = time.ParseDuration(cfg.Sync.PollInterval)
	if err != nil {
		return nil, fmt.Errorf("invalid sync.poll_interval: %w", err)
	}
	cfg.Sync.FinalizationDelayDur, err = time.ParseDuration(cfg.Sync.FinalizationDelay)
	if err != nil {
		return nil, fmt.Errorf("invalid sync.finalization_delay: %w", err)
	}

	if cfg.Labels.Static == nil {
		cfg.Labels.Static = map[string]string{}
	}

	if cfg.VictoriaMetrics.WriteURL == "" {
		baseURL := strings.TrimRight(cfg.VictoriaMetrics.BaseURL, "/")
		importPath := cfg.VictoriaMetrics.ImportPath
		if !strings.HasPrefix(importPath, "/") {
			importPath = "/" + importPath
		}
		cfg.VictoriaMetrics.WriteURL = baseURL + importPath
	}

	return cfg, nil
}

func defaultConfig() *Config {
	return &Config{
		Source: SourceConfig{
			ProjectsDir: "~/.claude/projects",
		},
		State: StateConfig{
			DBPath: "~/.local/state/claude-vm-exporter/state.db",
		},
		VictoriaMetrics: VictoriaMetricsConfig{
			ImportPath: "/api/v1/import/prometheus",
			Timeout:    "30s",
		},
		Sync: SyncConfig{
			PollInterval:      "1m",
			FinalizationDelay: "65m",
		},
		Labels: LabelsConfig{
			Static: map[string]string{},
		},
	}
}

func applyEnvOverrides(cfg *Config) {
	override := func(env string, target *string) {
		if value := os.Getenv(env); value != "" {
			*target = value
		}
	}

	override("CLAUDE_VM_EXPORTER_PROJECTS_DIR", &cfg.Source.ProjectsDir)
	override("CLAUDE_VM_EXPORTER_STATE_DB_PATH", &cfg.State.DBPath)
	override("CLAUDE_VM_EXPORTER_VM_WRITE_URL", &cfg.VictoriaMetrics.WriteURL)
	override("CLAUDE_VM_EXPORTER_VM_BASE_URL", &cfg.VictoriaMetrics.BaseURL)
	override("CLAUDE_VM_EXPORTER_VM_IMPORT_PATH", &cfg.VictoriaMetrics.ImportPath)
	override("CLAUDE_VM_EXPORTER_VM_TIMEOUT", &cfg.VictoriaMetrics.Timeout)
	override("CLAUDE_VM_EXPORTER_VM_BEARER_TOKEN", &cfg.VictoriaMetrics.Auth.BearerToken)
	override("CLAUDE_VM_EXPORTER_VM_BASIC_AUTH_USER", &cfg.VictoriaMetrics.Auth.BasicAuthUser)
	override("CLAUDE_VM_EXPORTER_VM_BASIC_AUTH_PASSWORD", &cfg.VictoriaMetrics.Auth.BasicAuthPassword)
	override("CLAUDE_VM_EXPORTER_POLL_INTERVAL", &cfg.Sync.PollInterval)
	override("CLAUDE_VM_EXPORTER_FINALIZATION_DELAY", &cfg.Sync.FinalizationDelay)
	override("CLAUDE_VM_EXPORTER_HEALTH_LISTEN_ADDR", &cfg.Health.ListenAddr)
}

func expandPath(path string) (string, error) {
	if path == "" {
		return "", nil
	}

	if strings.HasPrefix(path, "~") {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		if path == "~" {
			path = homeDir
		} else {
			path = filepath.Join(homeDir, strings.TrimPrefix(path, "~/"))
		}
	}

	path = os.ExpandEnv(path)
	return filepath.Abs(path)
}
