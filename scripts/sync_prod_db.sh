#!/bin/bash
set -e

# Configuration (must match manual_deploy.sh)
SERVER_ALIAS="norish-server"
ZONE="us-central1-a"
LOCAL_DB_CONTAINER="norish-db-local"

echo "=== Syncing Production DB to Local Dev ==="

echo ">> Step 1: Dumping remote database..."
# Run pg_dump inside the remote docker container
REMOTE_CMD="docker exec -t norish-db pg_dump -U postgres -c norish > ~/norish_dump.sql"

if command -v gcloud &> /dev/null; then
    gcloud compute ssh "$SERVER_ALIAS" --zone "$ZONE" --project norish-family-recipes --command "$REMOTE_CMD"
else
    echo "gcloud not found, trying ssh..."
    ssh "$SERVER_ALIAS" "$REMOTE_CMD"
fi

echo ">> Step 2: Downloading dump..."
if command -v gcloud &> /dev/null; then
    gcloud compute scp "$SERVER_ALIAS":~/norish_dump.sql ./norish_dump.sql --zone "$ZONE" --project norish-family-recipes
else
    scp "$SERVER_ALIAS":~/norish_dump.sql ./norish_dump.sql
fi

echo ">> Step 3: Restoring to local database ($LOCAL_DB_CONTAINER)..."
# Check if container is running
if [ ! "$(docker ps -q -f name=$LOCAL_DB_CONTAINER)" ]; then
    echo "Error: Local database container '$LOCAL_DB_CONTAINER' is not running."
    echo "Please run: pnpm docker:up"
    exit 1
fi

# Wait for DB to be ready (simple check)
until docker exec $LOCAL_DB_CONTAINER pg_isready -U postgres; do
  echo "Waiting for database to be ready..."
  sleep 2
done

# Restore
# The -c flag in pg_dump adds DROP TABLE commands, so we can just pipe it in.
cat ./norish_dump.sql | docker exec -i $LOCAL_DB_CONTAINER psql -U postgres -d norish

echo ">> Step 4: Cleanup..."
rm ./norish_dump.sql
# Remote cleanup
REMOTE_CLEANUP="rm ~/norish_dump.sql"
if command -v gcloud &> /dev/null; then
    gcloud compute ssh "$SERVER_ALIAS" --zone "$ZONE" --project norish-family-recipes --command "$REMOTE_CLEANUP"
else
    ssh "$SERVER_ALIAS" "$REMOTE_CLEANUP"
fi

echo "=== Sync Complete! ==="
