#!/bin/bash
set -e

# Configuration
IMAGE_FILE="norish-server.tar.gz"
SERVER_ALIAS="norish-server" # SSH alias or user@ip
ZONE="us-central1-a"

echo "=== Norish Manual Deployment ==="

if [ ! -f "$IMAGE_FILE" ]; then
    echo "Error: $IMAGE_FILE not found. Did the build complete?"
    exit 1
fi

echo ">> Step 1: Uploading artifact..."

if command -v gcloud &> /dev/null; then
    echo "Using gcloud..."
    gcloud compute scp "$IMAGE_FILE" "$SERVER_ALIAS":~/"$IMAGE_FILE" --zone "$ZONE" --project norish-family-recipes
else
    echo "gcloud not found. Attempting standard scp..."
    # Note: Requires ~/.ssh/config alias or valid DNS for 'norish-server'
    scp "$IMAGE_FILE" "$SERVER_ALIAS":~/"$IMAGE_FILE"
fi

echo ">> Step 2: Loading and Restarting on Server..."

REMOTE_CMD="set -e
echo '  > Loading Docker image...'
gzip -cd ~/norish-server.tar.gz | docker load

echo '  > Restarting containers...'
cd ~/norish/docker
# docker-compose down
# Ensure concurrency is limited for e2-micro
export WORKER_CONCURRENCY_RECIPE_IMPORT=1
docker-compose up -d --force-recreate

echo '  > Cleaning up...'
rm ~/norish-server.tar.gz
# Optional: prune old images to save space on e2-micro
docker image prune -a -f --filter 'until=24h'
"

if command -v gcloud &> /dev/null; then
    echo "Using gcloud ssh..."
    gcloud compute ssh "$SERVER_ALIAS" --zone "$ZONE" --project norish-family-recipes --command "$REMOTE_CMD"
else
    echo "Using standard ssh..."
    ssh "$SERVER_ALIAS" "$REMOTE_CMD"
fi

echo "=== Deployment Complete ==="
