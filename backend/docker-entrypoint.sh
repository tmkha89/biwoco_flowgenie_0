#!/bin/sh

echo "🚀 Starting FlowGenie Backend..."

# Wait for database to be ready (simple retry loop)
echo "⏳ Waiting for database to be ready..."
RETRIES=30
DB_READY=0
while [ $RETRIES -gt 0 ]; do
  # Try to connect using Prisma's migrate status (lighter than execute)
  if npx prisma migrate status > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    DB_READY=1
    break
  fi
  echo "Waiting for database... ($RETRIES retries left)"
  RETRIES=$((RETRIES-1))
  sleep 2
done

if [ $DB_READY -eq 0 ]; then
  echo "⚠️ Could not connect to database after 60 seconds"
  echo "⚠️ Will attempt migrations anyway..."
fi

# Run migrations in production mode
echo "📦 Running database migrations..."
npx prisma migrate deploy || {
  echo "⚠️ Migration command completed (may have failed or already applied)"
}

# Start the application
echo "🚀 Starting NestJS application..."
set -e
exec "$@"

