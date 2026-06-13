#!/bin/bash
# Install backend + frontend dependencies.
# Runs as a SessionStart hook so it works in both cloud and local sessions,
# with $CLAUDE_PROJECT_DIR pointing at the repo root.
set -e

cd "$CLAUDE_PROJECT_DIR"

# Skip if already installed (keeps session startup fast on resume).
if [ -d "node_modules" ] && [ -d "web/node_modules" ]; then
  echo "Dependencies already present, skipping install."
  exit 0
fi

echo "Installing backend dependencies (root)..."
pnpm install

echo "Installing frontend dependencies (web/)..."
cd web && pnpm install

echo "Dependency install complete."
exit 0
