#!/usr/bin/env bash
# =============================================================================
# GET READY BACKEND — DOCKER & DOCKER COMPOSE BOOTSTRAP SCRIPT
# Target: AWS EC2 (Ubuntu 22.04 / 24.04 LTS)
# Ensures Docker engine and Docker Compose v2 plugin are installed and active.
# =============================================================================

set -eo pipefail

echo "================================================================="
echo "🐳 CHECKING DOCKER & DOCKER COMPOSE SYSTEM BOOTSTRAP"
echo "   Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================="

# 1. Check if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
  echo "📦 Docker not detected. Installing Docker CE..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg lsb-release

  sudo install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  echo \
    "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  echo "✅ Docker CE installed successfully."
else
  echo "✅ Docker is already installed: $(docker --version)"
fi

# 2. Ensure Docker service is running and enabled
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet docker; then
    echo "⚡ Starting Docker daemon..."
    sudo systemctl enable docker
    sudo systemctl start docker
  fi
  echo "✅ Docker daemon is running and enabled."
fi

# 3. Check Docker Compose v2 plugin
if ! docker compose version >/dev/null 2>&1; then
  echo "📦 Installing Docker Compose v2 plugin..."
  sudo apt-get update -y
  sudo apt-get install -y docker-compose-plugin
  echo "✅ Docker Compose plugin installed."
else
  echo "✅ Docker Compose plugin is available: $(docker compose version)"
fi

# 4. Ensure current user belongs to docker group if running as non-root
if [ "$(id -u)" -ne 0 ]; then
  if ! groups | grep -q '\bdocker\b'; then
    echo "👤 Adding $(whoami) to the docker group..."
    sudo usermod -aG docker "$(whoami)" || true
  fi
fi

echo "================================================================="
echo "🎉 DOCKER BOOTSTRAP VERIFICATION COMPLETE"
echo "================================================================="
