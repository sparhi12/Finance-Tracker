#!/usr/bin/env bash
# =============================================================================
# Finance Tracker - Automated GCP Free-Tier VM Setup Script
# Configures swap, dependencies, Tailscale, systemd auto-start, and database.
# =============================================================================
set -e

echo "============================================================================="
echo "  💰 Setting up Finance Tracker on GCP VM"
echo "============================================================================="

# Ensure script is run with root privileges
if [ "$EUID" -ne 0 ]; then
  echo "[Error] Please run this script as root (e.g. sudo bash deploy/setup_vm.sh)"
  exit 1
fi

# 1. Configure 2GB Swapfile (Vital for 1GB RAM e2-micro instances)
echo "[1/6] Configuring 2GB swap space for memory stability..."
if ! grep -q '/swapfile' /etc/fstab; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "      -> 2GB Swapfile created and enabled."
else
    echo "      -> Swapfile already present."
fi

# 2. Install System Dependencies
echo "[2/6] Installing Linux packages (Python 3, venv, git, curl)..."
apt-get update -y
apt-get install -y python3 python3-pip python3-venv git curl ufw

# 3. Install Tailscale (for Zero-Exposure Private Mobile Access)
echo "[3/6] Setting up Tailscale for secure, encrypted private VPN access..."
if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "      -> Tailscale installed."
else
    echo "      -> Tailscale is already installed."
fi

# 4. Setup Application Directory
INSTALL_DIR="/opt/finance-tracker"
echo "[4/6] Installing application in ${INSTALL_DIR}..."

if [ ! -d "${INSTALL_DIR}" ]; then
    mkdir -p "${INSTALL_DIR}"
    # If running from inside a cloned repo, copy files over
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    if [ -f "${SCRIPT_DIR}/run.py" ]; then
        cp -r "${SCRIPT_DIR}"/* "${INSTALL_DIR}/"
    else
        git clone https://github.com/sparhi12/Finance-Tracker.git "${INSTALL_DIR}"
    fi
fi

cd "${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}/data"
mkdir -p "${INSTALL_DIR}/data/backups"

# 5. Create Python Virtual Environment & Install Dependencies
echo "[5/6] Creating Python virtual environment and installing packages..."
if [ ! -d "${INSTALL_DIR}/venv" ]; then
    python3 -m venv "${INSTALL_DIR}/venv"
fi

"${INSTALL_DIR}/venv/bin/pip" install --upgrade pip
"${INSTALL_DIR}/venv/bin/pip" install -r "${INSTALL_DIR}/requirements.txt"

# 6. Configure Systemd Service
echo "[6/6] Configuring and starting systemd service (auto-start on boot)..."
cp "${INSTALL_DIR}/deploy/finance-tracker.service" /etc/systemd/system/finance-tracker.service
systemctl daemon-reload
systemctl enable finance-tracker.service
systemctl restart finance-tracker.service

echo ""
echo "============================================================================="
echo "  ✅ INSTALLATION COMPLETE!"
echo "============================================================================="
echo ""
echo "Next Steps to connect your Phone:"
echo "1. Run: sudo tailscale up"
echo "   (Open the link printed in terminal to authenticate your VM into your Tailscale)"
echo ""
echo "2. Install the free Tailscale app on your phone (iOS / Android) and sign in."
echo ""
echo "3. Run 'tailscale ip -4' on this VM to see its Tailscale IP (e.g. 100.x.y.z)."
echo ""
echo "4. On your phone's browser, open: http://<VM-TAILSCALE-IP>:8501"
echo "   -> You now have 24/7 private, encrypted mobile access to your Finance Tracker!"
echo "============================================================================="
