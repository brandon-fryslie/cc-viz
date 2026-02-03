//go:build embed_frontend

package main

import "embed"

// frontendFS embeds the viz-frontend-embed directory at build time.
// This is the single source of truth for the frontend assets when embedding is enabled.
//
// Build tags ensure this is only included when -tags embed_frontend is specified.
// The viz-frontend-embed directory is a copy of viz-frontend/dist created during the build process.
//
//go:embed all:viz-frontend-embed
var frontendFS embed.FS

var embedFrontend = true
