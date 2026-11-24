#!/usr/bin/env bash
# =============================================================================
# Helper script to deploy Finance Tracker directly to your GCP VM via SSH
# Usage: ./deploy/deploy_to_vm.sh <username>@<vm-ip> [ssh-key-path]
# =============================================================================
set -e

VM_TARGET="$1"
SSH_KEY="$2"

if [ -z "$VM_TARGET" ]; then
    echo "Usage: ./deploy/deploy_to_vm.sh <username>@<vm-external-ip> [optional-ssh-key-path]"
    echo "Example: ./deploy/deploy_to_vm.sh debian@34.122.50.10 ~/.ssh/google_compute_engine"
    exit 1
fi

SSH_OPTS=""
if [ -n "$SSH_KEY" ]; then
    SSH_OPTS="-i $SSH_KEY"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "============================================================================="
echo "  Deploying Finance Tracker to: $VM_TARGET"
echo "============================================================================="

# 1. Sync project files to remote /tmp/finance-tracker
echo "[1/3] Uploading project files to VM..."
ssh $SSH_OPTS "$VM_TARGET" "mkdir -p /tmp/finance-tracker"
rsync -avz --exclude 'venv' --exclude '__pycache__' --exclude '.git' --exclude 'data' \
    -e "ssh $SSH_OPTS" "$SCRIPT_DIR/" "$VM_TARGET:/tmp/finance-tracker/"

# 2. Run remote setup
echo "[2/3] Running remote setup on VM..."
ssh $SSH_OPTS "$VM_TARGET" "sudo bash /tmp/finance-tracker/deploy/setup_vm.sh"

echo "[3/3] Done!"
