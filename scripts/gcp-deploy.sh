#!/bin/bash
set -e

# Configuration
IMAGE_TAG="norishapp/norish:test"
OUTPUT_FILE="norish-server.tar.gz"

echo "=== Norish Unified Deployment ==="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: docker could not be found."
    exit 1
fi

echo ">> Step 1: Building Docker Image..."
# Using the package.json script for consistency
pnpm run docker:build

echo ">> Step 2: Saving Docker Image to $OUTPUT_FILE..."
docker save "$IMAGE_TAG" | gzip > "$OUTPUT_FILE"

if [ ! -f "$OUTPUT_FILE" ]; then
    echo "Error: Failed to create $OUTPUT_FILE"
    exit 1
fi

echo ">> Step 3: Triggering Deployment..."
# Execute the existing manual deployment script
./manual_deploy.sh

echo "=== Process Complete ==="
