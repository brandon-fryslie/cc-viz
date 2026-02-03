package handler

import (
	"bytes"
	"embed"
	"io"
	"io/fs"
	"log"
	"net/http"
	"path/filepath"
	"strings"
)

// StaticHandler serves embedded frontend assets with SPA fallback to index.html.
//
// This is the single enforcer of static file serving rules:
// - Serve static assets from /assets/* directly
// - For all other paths (that aren't API paths), serve index.html for SPA routing
// - Never intercept /api/* paths (those are handled by API routes)
//
// ONE ENFORCER: All static file serving logic lives here, not scattered across handlers.
type StaticHandler struct {
	fs     fs.FS
	logger *log.Logger
}

// NewStaticHandler creates a handler for serving embedded frontend assets.
//
// The fs parameter must be rooted at the dist directory (e.g., "viz-frontend/dist").
func NewStaticHandler(embedFS embed.FS, distPath string, logger *log.Logger) (*StaticHandler, error) {
	// Extract the subdirectory from the embed.FS
	subFS, err := fs.Sub(embedFS, distPath)
	if err != nil {
		return nil, err
	}

	return &StaticHandler{
		fs:     subFS,
		logger: logger,
	}, nil
}

// ServeHTTP implements http.Handler for SPA serving with proper fallback.
//
// Behavior:
// - /assets/* → serve static file or 404
// - All other paths → serve index.html (SPA routing)
//
// Note: API paths (/api/*) should be registered before this handler to avoid interception.
func (h *StaticHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Strip leading slash for fs.Open
	if path == "/" {
		path = "index.html"
	} else {
		path = strings.TrimPrefix(path, "/")
	}

	// Try to open the requested file
	file, err := h.fs.Open(path)
	if err != nil {
		// File doesn't exist - serve index.html for SPA routing
		h.serveIndex(w, r)
		return
	}
	defer file.Close()

	// Check if it's a directory
	stat, err := file.Stat()
	if err != nil {
		h.logger.Printf("Error stat'ing file %s: %v", path, err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	if stat.IsDir() {
		// Directory requested - serve index.html for SPA routing
		h.serveIndex(w, r)
		return
	}

	// It's a real file - serve it with proper content type
	contentType := getContentType(path)
	w.Header().Set("Content-Type", contentType)

	// Read file content and serve with http.ServeContent for proper caching
	content, err := io.ReadAll(file)
	if err != nil {
		h.logger.Printf("Error reading file %s: %v", path, err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, stat.Name(), stat.ModTime(), bytes.NewReader(content))
}

// serveIndex serves the index.html file for SPA routing.
func (h *StaticHandler) serveIndex(w http.ResponseWriter, r *http.Request) {
	file, err := h.fs.Open("index.html")
	if err != nil {
		h.logger.Printf("Error opening index.html: %v", err)
		http.Error(w, "Frontend not available", http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		h.logger.Printf("Error stat'ing index.html: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	content, err := io.ReadAll(file)
	if err != nil {
		h.logger.Printf("Error reading index.html: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	http.ServeContent(w, r, "index.html", stat.ModTime(), bytes.NewReader(content))
}

// getContentType returns the appropriate Content-Type header for a file path.
//
// This is a simple implementation - for production you might want mime.TypeByExtension.
func getContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".json":
		return "application/json"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".ttf":
		return "font/ttf"
	case ".eot":
		return "application/vnd.ms-fontobject"
	default:
		return "application/octet-stream"
	}
}
