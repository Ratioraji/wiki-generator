#!/bin/sh
set -e

# Start Redis in the background
redis-server --daemonize yes --maxmemory 128mb --maxmemory-policy allkeys-lru

# Start the Node.js app
exec node dist/src/main.js
