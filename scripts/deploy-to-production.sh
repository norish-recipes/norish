#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

SERVER="norish-server"
ZONE="us-central1-a"
PROJECT="norish-family-recipes"
IMAGE_NAME="norishapp/norish"
# Dynamically get version from package.json
VERSION=$(node -p "require('./package.json').version")
IMAGE_TAG="v${VERSION}-provenance"
DOCKER_DIR="~/norish/docker"

echo "=== Norish Production GCP Deployment ==="
echo "Target: $SERVER ($ZONE) in $PROJECT"
echo "Image: $IMAGE_NAME:$IMAGE_TAG (amd64 Architecture)"
echo ""

# Step 1: Build Docker image locally (crucial to specify AMD64 since host is ARM64)
echo "Step 1/5: Building Docker image for linux/amd64 locally..."
cd /Users/edylan/Development/norish
docker build --platform linux/amd64 -f docker/Dockerfile -t $IMAGE_NAME:$IMAGE_TAG .

# Step 2: Save Docker image to tar file
echo ""
echo "Step 2/5: Saving Docker image to tar file..."
docker save $IMAGE_NAME:$IMAGE_TAG | gzip > norish-server.tar.gz
echo "Image saved: norish-server.tar.gz ($(du -h norish-server.tar.gz | cut -f1))"

# Step 3: Upload Docker image to server via gcloud
echo ""
echo "Step 3/5: Uploading Docker image to GCP..."
gcloud compute scp norish-server.tar.gz $SERVER:~/norish-server.tar.gz --zone $ZONE --project $PROJECT

# Step 4: Load and deploy on server via gcloud
echo ""
echo "Step 4/5: Loading image and deploying on server..."
REMOTE_CMD="set -e
echo '  > Loading Docker image...'
gzip -cd ~/norish-server.tar.gz | docker load
echo '  > Tagging images to test and latest...'
docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:latest
docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:test
echo '  > Restarting containers...'
cd $DOCKER_DIR
docker-compose up -d --force-recreate
echo '  > Cleaning up...'
rm ~/norish-server.tar.gz
docker image prune -a -f --filter \"until=24h\"
"
gcloud compute ssh $SERVER --zone $ZONE --project $PROJECT --command "$REMOTE_CMD"

# Step 5: Verify deployment
echo ""
echo "Step 5/5: Verifying deployment..."
sleep 10
gcloud compute ssh $SERVER --zone $ZONE --project $PROJECT --command "docker exec norish-app node -e \"require('http').get('http://localhost:3000/api/health', r => console.log('Health check status:', r.statusCode))\"" || echo "Health check command failed, but deployment might be successful, check logs."

echo ""
echo "=== Deployment Complete ==="
echo "Cleanup: rm norish-server.tar.gz locally"
rm norish-server.tar.gz
