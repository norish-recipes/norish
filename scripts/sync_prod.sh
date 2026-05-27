#!/bin/bash
set -e

echo "=== Norish Production Sync ==="
echo "This script will overwrite your LOCAL database and uploads with data from PRODUCTION."
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Sync cancelled."
    exit 1
fi

SCRIPT_DIR=$(dirname "$0")

# 1. Sync Database
echo ""
echo ">>> Starting Database Sync..."
"$SCRIPT_DIR/sync_prod_db.sh"

# 2. Sync Assets
echo ""
echo ">>> Starting Asset Sync..."
"$SCRIPT_DIR/sync_prod_assets.sh"

echo ""
echo "=== Production Sync Complete ==="
echo "You may need to restart your local server if it was running."
