#!/bin/sh
set -e

# Run database migrations before starting the app
echo "Running migrations..."
node dist/src/migration-runner.js

# Start the Node.js app
exec node dist/src/main.js
