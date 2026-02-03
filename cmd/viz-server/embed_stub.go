//go:build !embed_frontend

package main

import "embed"

// frontendFS is an empty embed.FS when frontend embedding is disabled.
// This allows the code to compile without the viz-frontend/dist directory present.
var frontendFS embed.FS

var embedFrontend = false
