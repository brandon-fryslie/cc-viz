# CC-Viz Justfile

# Default recipe
default: build

# Install dependencies
install:
    go mod download
    pnpm --filter ./frontend install --prod=false

# Build the viz-server binary
build:
    CGO_ENABLED=1 go build -tags fts5 -o bin/viz-server ./cmd/viz-server

# Build with embedded frontend
build-embedded: install
    pnpm --filter ./frontend run build
    rm -rf cmd/viz-server/viz-frontend-embed
    mkdir -p cmd/viz-server/viz-frontend-embed
    cp -r frontend/dist/. cmd/viz-server/viz-frontend-embed/
    CGO_ENABLED=1 go build -tags "fts5 embed_frontend" -o bin/viz-server ./cmd/viz-server

# Run the viz-server
run: build
    ./bin/viz-server

# Run with embedded frontend
run-embedded: build-embedded
    ./bin/viz-server

# Run frontend dev server (for development with HMR)
run-frontend-dev: install
    pnpm --filter ./frontend run dev

# Run viz-server + frontend dev server in parallel
dev:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    just run &
    just run-frontend-dev &
    wait

# Run tests
test:
    CGO_ENABLED=1 go test -tags fts5 ./...

# Run linter
lint:
    go run github.com/golangci/golangci-lint/cmd/golangci-lint@latest run

# Check types in frontend
typecheck:
    pnpm --filter ./frontend run typecheck

# Lint and typecheck
check: lint typecheck

# Verify deferred test inventory is in sync with skipped tests
check-deferred-tests:
    ./scripts/check-deferred-tests.sh

# Clean build artifacts
clean:
    rm -rf bin/
    rm -rf frontend/dist/
    rm -rf frontend/node_modules/
    rm -f requests.db

# Reset database
db:
    rm -f requests.db

# Format code
fmt:
    go fmt ./...
    pnpm --filter ./frontend run format

# Show help
help:
    @just --list
