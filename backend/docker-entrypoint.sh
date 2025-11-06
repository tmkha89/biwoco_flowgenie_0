#!/bin/sh

echo "🚀 Starting FlowGenie Backend..."
echo "PORT environment variable: ${PORT:-3000}"
echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la | head -20

# Start the application immediately
# Run migrations in background so health checks can pass quickly
# The app should handle database connection failures gracefully
echo "🚀 Starting NestJS application..."
echo "Starting with command: $@"

# Run migrations in background (non-blocking)
(
  echo "📦 Running database migrations in background..."
  if command -v timeout >/dev/null 2>&1; then
    timeout 60 npx prisma migrate deploy 2>&1 || {
      echo "⚠️ Migration command completed (may have failed or already applied, or timed out)"
    }
  else
    npx prisma migrate deploy 2>&1 || {
      echo "⚠️ Migration command completed (may have failed or already applied)"
    }
  fi
) &

# Start the application (this blocks and is the main process)
exec "$@"

