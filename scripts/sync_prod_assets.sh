#!/bin/bash
set -e

# Configuration (must match manual_deploy.sh)
SERVER_ALIAS="norish-server"
ZONE="us-central1-a"
REMOTE_CONTAINER="norish-app" # The container name in docker-compose.yml
LOCAL_UPLOADS_DIR="./.runtime/uploads"

echo "=== Syncing Production Assets to Local Dev ==="

echo ">> Step 1: Tarring remote uploads..."
# Create a tarball of the /app/uploads directory inside the container
# We use docker exec to run tar inside the container to avoid permission issues with volumes
REMOTE_CMD="docker exec $REMOTE_CONTAINER tar -czf /tmp/uploads.tar.gz -C /app uploads"
# Then move it out of the container so we can download it
REMOTE_CMD_2="docker cp $REMOTE_CONTAINER:/tmp/uploads.tar.gz ~/uploads.tar.gz"

if command -v gcloud &> /dev/null; then
    gcloud compute ssh "$SERVER_ALIAS" --zone "$ZONE" --project norish-family-recipes --command "$REMOTE_CMD && $REMOTE_CMD_2"
else
    echo "gcloud not found, trying ssh..."
    ssh "$SERVER_ALIAS" "$REMOTE_CMD && $REMOTE_CMD_2"
fi

echo ">> Step 2: Downloading tarball..."
if command -v gcloud &> /dev/null; then
    gcloud compute scp "$SERVER_ALIAS":~/uploads.tar.gz ./uploads.tar.gz --zone "$ZONE" --project norish-family-recipes
else
    scp "$SERVER_ALIAS":~/uploads.tar.gz ./uploads.tar.gz
fi

echo ">> Step 3: Extracting to local directory..."
mkdir -p "./.runtime"
# Extract, stripping the first component (uploads/) because we are extracting into ./uploads
# Wait, tar -C /app uploads means the tar contains uploads/file.txt
# So if we extract to ./ ... we get ./uploads/file.txt
# But we made mkdir ./uploads ... so we might get ./uploads/uploads/file.txt if we act carelessly.
# Let's extract to ./.runtime directory, overwriting existing ./.runtime/uploads/ content
tar -xzf ./uploads.tar.gz -C ./.runtime

echo ">> Step 4: Cleanup..."
rm ./uploads.tar.gz
# Remote cleanup
REMOTE_CLEANUP="rm ~/uploads.tar.gz && docker exec $REMOTE_CONTAINER rm /tmp/uploads.tar.gz"
if command -v gcloud &> /dev/null; then
    gcloud compute ssh "$SERVER_ALIAS" --zone "$ZONE" --project norish-family-recipes --command "$REMOTE_CLEANUP"
else
    ssh "$SERVER_ALIAS" "$REMOTE_CLEANUP"
fi

echo "=== Asset Sync Complete! ==="
