package service

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/brandon-fryslie/cc-viz/internal/model"
)

// ExtensionIndexer handles indexing of Claude Code extensions
type ExtensionIndexer struct {
	storage *SQLiteStorageService
}

// NewExtensionIndexer creates a new ExtensionIndexer
func NewExtensionIndexer(storage RuntimeStorageService) *ExtensionIndexer {
	sqliteStorage, ok := storage.(*SQLiteStorageService)
	if !ok {
		log.Printf("❌ ExtensionIndexer: storage is not SQLiteStorageService (type=%T)", storage)
		return &ExtensionIndexer{}
	}
	log.Printf("✅ ExtensionIndexer: initialized with SQLite storage")
	return &ExtensionIndexer{
		storage: sqliteStorage,
	}
}

// IndexExtensions scans and indexes all extensions (user + plugins)
func (ei *ExtensionIndexer) IndexExtensions() error {
	log.Printf("🔍 IndexExtensions: starting extension indexing")

	if ei.storage == nil {
		log.Printf("❌ IndexExtensions: storage is nil - returning error")
		return fmt.Errorf("storage service not available")
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("❌ IndexExtensions: failed to get home directory: %v", err)
		return fmt.Errorf("failed to get home directory: %w", err)
	}

	claudeDir := filepath.Join(homeDir, ".claude")
	log.Printf("📁 IndexExtensions: claude directory: %s", claudeDir)

	// Check if .claude directory exists
	if _, err := os.Stat(claudeDir); os.IsNotExist(err) {
		log.Printf("❌ IndexExtensions: .claude directory does not exist: %s", claudeDir)
		return fmt.Errorf(".claude directory not found: %s", claudeDir)
	}

	// Clear old extensions (full reindex)
	log.Printf("🗑️  IndexExtensions: clearing old extensions")
	if err := ei.clearExtensions(); err != nil {
		log.Printf("⚠️  IndexExtensions: failed to clear extensions: %v", err)
	} else {
		log.Printf("✅ IndexExtensions: old extensions cleared")
	}

	// Index user extensions
	log.Printf("👤 IndexExtensions: indexing user extensions")
	if err := ei.indexUserExtensions(claudeDir); err != nil {
		log.Printf("❌ IndexExtensions: error indexing user extensions: %v", err)
		// Continue anyway - partial success is better than complete failure
	} else {
		log.Printf("✅ IndexExtensions: user extensions indexed")
	}

	// Index plugin extensions
	log.Printf("🔌 IndexExtensions: indexing plugin extensions")
	if err := ei.indexPluginExtensions(claudeDir); err != nil {
		log.Printf("❌ IndexExtensions: error indexing plugin extensions: %v", err)
		// Continue anyway
	} else {
		log.Printf("✅ IndexExtensions: plugin extensions indexed")
	}

	log.Println("✅ IndexExtensions: extension indexing complete")
	return nil
}

// clearExtensions removes all extensions from database before reindex
func (ei *ExtensionIndexer) clearExtensions() error {
	_, err := ei.storage.db.Exec("DELETE FROM extensions")
	return err
}

// indexUserExtensions indexes extensions from ~/.claude/
func (ei *ExtensionIndexer) indexUserExtensions(claudeDir string) error {
	log.Printf("📂 indexUserExtensions: scanning %s", claudeDir)

	// Index agents
	log.Printf("🤖 indexUserExtensions: indexing agents")
	if err := ei.indexAgents(claudeDir, "user", "", ""); err != nil {
		log.Printf("⚠️  indexUserExtensions: error indexing user agents: %v", err)
	}

	// Index commands
	log.Printf("⌨️  indexUserExtensions: indexing commands")
	if err := ei.indexCommands(claudeDir, "user", "", ""); err != nil {
		log.Printf("⚠️  indexUserExtensions: error indexing user commands: %v", err)
	}

	// Index skills
	log.Printf("🎯 indexUserExtensions: indexing skills")
	if err := ei.indexSkills(claudeDir, "user", "", ""); err != nil {
		log.Printf("⚠️  indexUserExtensions: error indexing user skills: %v", err)
	}

	// Index MCP servers
	log.Printf("🔧 indexUserExtensions: indexing MCP servers")
	if err := ei.indexMCPServers(claudeDir, "user", "", ""); err != nil {
		log.Printf("⚠️  indexUserExtensions: error indexing user MCP servers: %v", err)
	}

	log.Printf("✅ indexUserExtensions: completed")
	return nil
}

// indexPluginExtensions reads installed plugins and indexes their components
func (ei *ExtensionIndexer) indexPluginExtensions(claudeDir string) error {
	installedPluginsPath := filepath.Join(claudeDir, "plugins", "installed_plugins.json")
	log.Printf("📦 indexPluginExtensions: reading %s", installedPluginsPath)

	data, err := os.ReadFile(installedPluginsPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Println("ℹ️  indexPluginExtensions: no installed_plugins.json found - skipping plugin indexing")
			return nil
		}
		log.Printf("❌ indexPluginExtensions: failed to read installed_plugins.json: %v", err)
		return fmt.Errorf("failed to read installed_plugins.json: %w", err)
	}

	var installedPlugins struct {
		Plugins map[string][]map[string]interface{} `json:"plugins"`
	}

	if err := json.Unmarshal(data, &installedPlugins); err != nil {
		log.Printf("❌ indexPluginExtensions: failed to parse installed_plugins.json: %v", err)
		return fmt.Errorf("failed to parse installed_plugins.json: %w", err)
	}

	log.Printf("📋 indexPluginExtensions: found %d plugin entries", len(installedPlugins.Plugins))

	for pluginKey, installations := range installedPlugins.Plugins {
		if len(installations) == 0 {
			continue
		}

		// Parse pluginKey as "plugin@marketplace"
		parts := strings.Split(pluginKey, "@")
		if len(parts) != 2 {
			log.Printf("⚠️  indexPluginExtensions: invalid plugin key format: %s", pluginKey)
			continue
		}
		pluginID := parts[0]
		marketplaceID := parts[1]

		// Get install path from first installation
		installation := installations[0]
		installPath, ok := installation["installPath"].(string)
		if !ok || installPath == "" {
			log.Printf("⚠️  indexPluginExtensions: no install path for plugin %s", pluginKey)
			continue
		}

		log.Printf("🔌 indexPluginExtensions: indexing plugin %s at %s", pluginKey, installPath)

		// Index all component types from this plugin
		if err := ei.indexAgents(installPath, pluginKey, pluginID, marketplaceID); err != nil {
			log.Printf("⚠️  indexPluginExtensions: error indexing agents for %s: %v", pluginKey, err)
		}
		if err := ei.indexCommands(installPath, pluginKey, pluginID, marketplaceID); err != nil {
			log.Printf("⚠️  indexPluginExtensions: error indexing commands for %s: %v", pluginKey, err)
		}
		if err := ei.indexSkills(installPath, pluginKey, pluginID, marketplaceID); err != nil {
			log.Printf("⚠️  indexPluginExtensions: error indexing skills for %s: %v", pluginKey, err)
		}
		if err := ei.indexHooks(installPath, pluginKey, pluginID, marketplaceID); err != nil {
			log.Printf("⚠️  indexPluginExtensions: error indexing hooks for %s: %v", pluginKey, err)
		}
		if err := ei.indexMCPServers(installPath, pluginKey, pluginID, marketplaceID); err != nil {
			log.Printf("⚠️  indexPluginExtensions: error indexing MCP for %s: %v", pluginKey, err)
		}
	}

	log.Printf("✅ indexPluginExtensions: completed")
	return nil
}

// indexAgents indexes agent files from agents/ directory
func (ei *ExtensionIndexer) indexAgents(baseDir, source, pluginID, marketplaceID string) error {
	agentsDir := filepath.Join(baseDir, "agents")
	if _, err := os.Stat(agentsDir); os.IsNotExist(err) {
		log.Printf("ℹ️  indexAgents: no agents directory at %s", agentsDir)
		return nil // No agents directory
	}

	entries, err := os.ReadDir(agentsDir)
	if err != nil {
		log.Printf("❌ indexAgents: failed to read directory %s: %v", agentsDir, err)
		return err
	}

	log.Printf("📁 indexAgents: found %d entries in %s", len(entries), agentsDir)

	agentCount := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		filePath := filepath.Join(agentsDir, entry.Name())
		name := strings.TrimSuffix(entry.Name(), ".md")
		description, metadata := ei.parseMarkdownFile(filePath)

		ext := &model.Extension{
			ID:          generateExtensionID("agent", name, source),
			Type:        "agent",
			Name:        name,
			Description: description,
			Enabled:     !ei.isDisabled(baseDir, "agents", entry.Name()),
			Source:      source,
			FilePath:    filePath,
		}

		if source != "user" {
			ext.PluginID = &pluginID
			ext.MarketplaceID = &marketplaceID
		}

		if metadata != nil {
			ext.MetadataJSON, _ = json.Marshal(metadata)
		}

		if err := ei.storage.SaveExtension(ext); err != nil {
			log.Printf("❌ indexAgents: failed to save agent %s: %v", name, err)
		} else {
			log.Printf("✅ indexAgents: saved agent %s (id=%s)", name, ext.ID)
			agentCount++
		}
	}

	log.Printf("✅ indexAgents: indexed %d agents from %s", agentCount, agentsDir)
	return nil
}

// indexCommands indexes command files from commands/ directory
func (ei *ExtensionIndexer) indexCommands(baseDir, source, pluginID, marketplaceID string) error {
	commandsDir := filepath.Join(baseDir, "commands")
	if _, err := os.Stat(commandsDir); os.IsNotExist(err) {
		log.Printf("ℹ️  indexCommands: no commands directory at %s", commandsDir)
		return nil
	}

	entries, err := os.ReadDir(commandsDir)
	if err != nil {
		log.Printf("❌ indexCommands: failed to read directory %s: %v", commandsDir, err)
		return err
	}

	log.Printf("📁 indexCommands: found %d entries in %s", len(entries), commandsDir)

	commandCount := 0
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		filePath := filepath.Join(commandsDir, entry.Name())
		name := strings.TrimSuffix(entry.Name(), ".md")
		description, metadata := ei.parseMarkdownFile(filePath)

		ext := &model.Extension{
			ID:          generateExtensionID("command", name, source),
			Type:        "command",
			Name:        name,
			Description: description,
			Enabled:     !ei.isDisabled(baseDir, "commands", entry.Name()),
			Source:      source,
			FilePath:    filePath,
		}

		if source != "user" {
			ext.PluginID = &pluginID
			ext.MarketplaceID = &marketplaceID
		}

		if metadata != nil {
			ext.MetadataJSON, _ = json.Marshal(metadata)
		}

		if err := ei.storage.SaveExtension(ext); err != nil {
			log.Printf("❌ indexCommands: failed to save command %s: %v", name, err)
		} else {
			log.Printf("✅ indexCommands: saved command %s (id=%s)", name, ext.ID)
			commandCount++
		}
	}

	log.Printf("✅ indexCommands: indexed %d commands from %s", commandCount, commandsDir)
	return nil
}

// indexSkills indexes skill directories from skills/
func (ei *ExtensionIndexer) indexSkills(baseDir, source, pluginID, marketplaceID string) error {
	skillsDir := filepath.Join(baseDir, "skills")
	if _, err := os.Stat(skillsDir); os.IsNotExist(err) {
		log.Printf("ℹ️  indexSkills: no skills directory at %s", skillsDir)
		return nil
	}

	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		log.Printf("❌ indexSkills: failed to read directory %s: %v", skillsDir, err)
		return err
	}

	log.Printf("📁 indexSkills: found %d entries in %s", len(entries), skillsDir)

	skillCount := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		skillPath := filepath.Join(skillsDir, entry.Name())
		skillFile := filepath.Join(skillPath, "SKILL.md")

		if _, err := os.Stat(skillFile); os.IsNotExist(err) {
			continue
		}

		name := entry.Name()
		description, metadata := ei.parseMarkdownFile(skillFile)

		ext := &model.Extension{
			ID:          generateExtensionID("skill", name, source),
			Type:        "skill",
			Name:        name,
			Description: description,
			Enabled:     !ei.isDisabled(baseDir, "skills", entry.Name()),
			Source:      source,
			FilePath:    skillFile,
		}

		if source != "user" {
			ext.PluginID = &pluginID
			ext.MarketplaceID = &marketplaceID
		}

		if metadata != nil {
			ext.MetadataJSON, _ = json.Marshal(metadata)
		}

		if err := ei.storage.SaveExtension(ext); err != nil {
			log.Printf("❌ indexSkills: failed to save skill %s: %v", name, err)
		} else {
			log.Printf("✅ indexSkills: saved skill %s (id=%s)", name, ext.ID)
			skillCount++
		}
	}

	log.Printf("✅ indexSkills: indexed %d skills from %s", skillCount, skillsDir)
	return nil
}

// indexHooks indexes hooks from hooks/hooks.json
func (ei *ExtensionIndexer) indexHooks(baseDir, source, pluginID, marketplaceID string) error {
	hooksFile := filepath.Join(baseDir, "hooks", "hooks.json")
	if _, err := os.Stat(hooksFile); os.IsNotExist(err) {
		log.Printf("ℹ️  indexHooks: no hooks file at %s", hooksFile)
		return nil
	}

	data, err := os.ReadFile(hooksFile)
	if err != nil {
		log.Printf("❌ indexHooks: failed to read %s: %v", hooksFile, err)
		return err
	}

	var hooks map[string]interface{}
	if err := json.Unmarshal(data, &hooks); err != nil {
		log.Printf("❌ indexHooks: failed to parse %s: %v", hooksFile, err)
		return err
	}

	description := ""
	if desc, ok := hooks["description"].(string); ok {
		description = desc
	}

	ext := &model.Extension{
		ID:          generateExtensionID("hook", "hooks", source),
		Type:        "hook",
		Name:        "hooks",
		Description: description,
		Enabled:     true,
		Source:      source,
		FilePath:    hooksFile,
	}

	if source != "user" {
		ext.PluginID = &pluginID
		ext.MarketplaceID = &marketplaceID
	}

	metadataJSON, _ := json.Marshal(hooks)
	ext.MetadataJSON = metadataJSON

	if err := ei.storage.SaveExtension(ext); err != nil {
		log.Printf("❌ indexHooks: failed to save hooks: %v", err)
		return err
	}

	log.Printf("✅ indexHooks: saved hooks (id=%s)", ext.ID)
	return nil
}

// indexMCPServers indexes MCP servers from .mcp.json
func (ei *ExtensionIndexer) indexMCPServers(baseDir, source, pluginID, marketplaceID string) error {
	mcpFile := filepath.Join(baseDir, ".mcp.json")
	if _, err := os.Stat(mcpFile); os.IsNotExist(err) {
		log.Printf("ℹ️  indexMCPServers: no MCP file at %s", mcpFile)
		return nil
	}

	data, err := os.ReadFile(mcpFile)
	if err != nil {
		log.Printf("❌ indexMCPServers: failed to read %s: %v", mcpFile, err)
		return err
	}

	var mcpConfig struct {
		MCPServers map[string]interface{} `json:"mcpServers"`
	}

	if err := json.Unmarshal(data, &mcpConfig); err != nil {
		log.Printf("❌ indexMCPServers: failed to parse %s: %v", mcpFile, err)
		return err
	}

	log.Printf("📁 indexMCPServers: found %d MCP servers in %s", len(mcpConfig.MCPServers), mcpFile)

	mcpCount := 0
	// Index each MCP server as a separate extension
	for serverName, serverConfig := range mcpConfig.MCPServers {
		description := fmt.Sprintf("MCP Server: %s", serverName)

		ext := &model.Extension{
			ID:          generateExtensionID("mcp", serverName, source),
			Type:        "mcp",
			Name:        serverName,
			Description: description,
			Enabled:     true,
			Source:      source,
			FilePath:    mcpFile,
		}

		if source != "user" {
			ext.PluginID = &pluginID
			ext.MarketplaceID = &marketplaceID
		}

		metadataJSON, _ := json.Marshal(serverConfig)
		ext.MetadataJSON = metadataJSON

		if err := ei.storage.SaveExtension(ext); err != nil {
			log.Printf("❌ indexMCPServers: failed to save MCP server %s: %v", serverName, err)
		} else {
			log.Printf("✅ indexMCPServers: saved MCP server %s (id=%s)", serverName, ext.ID)
			mcpCount++
		}
	}

	log.Printf("✅ indexMCPServers: indexed %d MCP servers from %s", mcpCount, mcpFile)
	return nil
}

// parseMarkdownFile extracts description and YAML frontmatter from a markdown file
func (ei *ExtensionIndexer) parseMarkdownFile(filePath string) (string, map[string]interface{}) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", nil
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var description string
	var metadata map[string]interface{}
	inFrontmatter := false
	frontmatterLines := []string{}

	for scanner.Scan() {
		line := scanner.Text()

		// Check for YAML frontmatter
		if line == "---" {
			if !inFrontmatter {
				inFrontmatter = true
				continue
			} else {
				// End of frontmatter
				// Parse YAML (simple key-value only)
				metadata = make(map[string]interface{})
				for _, fmLine := range frontmatterLines {
					if strings.Contains(fmLine, ":") {
						parts := strings.SplitN(fmLine, ":", 2)
						key := strings.TrimSpace(parts[0])
						value := strings.TrimSpace(parts[1])
						metadata[key] = value
					}
				}
				inFrontmatter = false
				continue
			}
		}

		if inFrontmatter {
			frontmatterLines = append(frontmatterLines, line)
			continue
		}

		// First non-empty, non-heading line is description
		if description == "" && line != "" && !strings.HasPrefix(line, "#") {
			description = strings.TrimSpace(line)
			break
		}
	}

	return description, metadata
}

// isDisabled checks if an extension is in the disabled directory
func (ei *ExtensionIndexer) isDisabled(baseDir, extType, name string) bool {
	disabledPath := filepath.Join(baseDir, extType+"-disabled", name)
	_, err := os.Stat(disabledPath)
	return err == nil
}

// generateExtensionID creates a unique ID for an extension
func generateExtensionID(extType, name, source string) string {
	if source == "user" {
		return fmt.Sprintf("%s:%s", extType, name)
	}
	// For plugins: type:name@source
	return fmt.Sprintf("%s:%s@%s", extType, name, source)
}
