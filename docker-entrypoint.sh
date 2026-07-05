#!/bin/sh
set -e
echo "Running database migrations..."
pnpm db:migrate
echo "Starting server..."
exec node dist/server.js
