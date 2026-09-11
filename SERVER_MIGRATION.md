# Server Migration & Portability Guide: GET READY Backend

This document describes the step-by-step procedure to migrate the **GET READY** backend platform between any cloud hosting provider or Linux VM (e.g., **AWS EC2 ↔ DigitalOcean Droplet ↔ Hetzner Cloud ↔ GCP Compute Engine ↔ Azure VM ↔ Bare Metal**) with **zero application code changes**.

---

## 1. Architectural Overview

```
                      [ INTERNET / CLIENTS ]
                                 │
                         Ports 80 & 443 (SSL)
                                 ▼
                     [ Nginx Reverse Proxy ]
                                 │
                   (Internal getready-network)
                                 │
                                 ▼
                      [ API Gateway :3000 ]
                                 │
      ┌───────────┬──────────────┼──────────────┬────────────┐
      ▼           ▼              ▼              ▼            ▼
 [Auth :3001] [User :3002] [Beautician :3003] [Catalog :3004] [Booking :3005]
      ▼           ▼              ▼              ▼            ▼
 [Cart :3006] [Payment :3007] [Wallet :3008] [Notification :3009] [Content :3010]
      └───────────┴──────────────┬──────────────┴────────────┘
                                 ▼
                         [Worker :3011]
                                 │
      ┌──────────────────────────┼───────────────────────────┐
      ▼                          ▼                           ▼
[ Redis :6379 ]         [ RabbitMQ :5672 ]         [ Observability Stack ]
(redis_data)             (rabbitmq_data)          (Prometheus/Grafana/Loki)
                                                             │
                                                             ▼
                                                [ External MongoDB Atlas ]
```

---

## 2. Migration Workflow Checklist

| Step | Action | Duration | Risk |
| :--- | :--- | :--- | :--- |
| **1** | Provision destination Linux server (Ubuntu 22.04/24.04 LTS recommended) | 5 mins | Low |
| **2** | Install Docker Engine & Docker Compose Plugin | 3 mins | Low |
| **3** | Backup Redis, RabbitMQ & Grafana volumes on source server | 2 mins | Low |
| **4** | Clone repository & configure `.env.production` on destination | 2 mins | Low |
| **5** | Restore volume archives onto destination server | 2 mins | Low |
| **6** | Launch containers with `docker compose up -d` & run health checks | 3 mins | Low |
| **7** | Provision SSL certificates (Let's Encrypt / Certbot) | 2 mins | Low |
| **8** | Update DNS A/AAAA Records (`api.getready.example.com`) | 5-15 mins | Medium |
| **9** | Verify live traffic & decommission old server | 10 mins | Low |

---

## 3. Step-by-Step Migration Guide

### Step 1: Backup Source Server
On the existing server, execute the automated backup script:

```bash
cd /opt/getready/Backend
chmod +x ./scripts/backup.sh
./scripts/backup.sh ./migration_backup
```

This creates a timestamped bundle containing:
- `redis-dump.rdb` (or `redis_data.tar.gz`)
- `rabbitmq-definitions.json` (or `rabbitmq_data.tar.gz`)
- `grafana_data.tar.gz`
- `prometheus_data.tar.gz` & `loki_data.tar.gz`

> **Note on MongoDB**: Database data is securely hosted on **MongoDB Atlas Cloud**. It does not need file-level migration. Ensure MongoDB Atlas Network Access (IP Access List) allows the IP address of the new server.

---

### Step 2: Provision Destination Server
Deploy a Linux VM on your target provider (e.g., DigitalOcean Droplet 8GB RAM, AWS EC2 `t3.xlarge`, Hetzner `CPX31`, GCP `e2-standard-4`).

Configure server firewall (UFW or Cloud Security Group):
- Allow inbound: `22` (SSH - restrict to admin IP), `80` (HTTP), `443` (HTTPS).
- Deny all direct inbound access to microservice ports (`3000-3011`), Redis (`6379`), RabbitMQ (`5672`, `15672`), Prometheus (`9090`), Loki (`3100`).

---

### Step 3: Install Docker & Docker Compose
On the destination server:

```bash
# Update package repositories
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker apt repository
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine & Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker on boot
sudo systemctl enable --now docker
```

---

### Step 4: Transfer Code & Restore Volumes
1. Transfer codebase to destination server:

```bash
mkdir -p /opt/getready
cd /opt/getready
git clone https://github.com/your-org/getready-backend.git Backend
cd Backend
```

2. Copy `.env.production` from secure secret storage:

```bash
cp .env.production.example .env.production
nano .env.production  # Set production DATABASE_URI, JWT_SECRET, REDIS_PASSWORD, etc.
```

3. Transfer and restore volume archives from source server:

```bash
# Copy migration_backup directory from old server to new server
scp -r user@old-server:/opt/getready/Backend/migration_backup ./migration_backup

# Create named volumes
docker volume create getready_redis_data
docker volume create getready_rabbitmq_data
docker volume create getready_grafana_data
docker volume create getready_prometheus_data
docker volume create getready_loki_data

# Restore Redis
docker run --rm -v getready_redis_data:/data -v $(pwd)/migration_backup:/backup alpine tar xzf /backup/redis_data.tar.gz -C /

# Restore RabbitMQ
docker run --rm -v getready_rabbitmq_data:/data -v $(pwd)/migration_backup:/backup alpine tar xzf /backup/rabbitmq_data.tar.gz -C /

# Restore Grafana
docker run --rm -v getready_grafana_data:/data -v $(pwd)/migration_backup:/backup alpine tar xzf /backup/grafana_data.tar.gz -C /
```

---

### Step 5: Launch Containers & Health Verification

1. Start all services using production Docker Compose:

```bash
chmod +x ./scripts/deploy.sh ./scripts/health-check.sh ./scripts/rollback.sh
./scripts/deploy.sh .env.production
```

2. Run automated health check probe:

```bash
./scripts/health-check.sh .env.production
```

3. Verify container status:

```bash
docker compose -f docker-compose.production.yml ps
```

---

### Step 6: SSL Provisioning & DNS Cutover

1. Obtain Let's Encrypt SSL certificates for `api.getready.example.com`:

```bash
# Obtain certificates via Certbot standalone or Docker certbot
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d api.getready.example.com --non-interactive --agree-tos -m admin@getready.example.com

# Copy or mount certificates to getready_nginx_ssl volume
docker run --rm -v getready_nginx_ssl:/etc/nginx/ssl -v /etc/letsencrypt:/letsencrypt alpine cp -r /letsencrypt/* /etc/nginx/ssl/
```

2. Reload Nginx to activate SSL:

```bash
docker compose -f docker-compose.production.yml restart nginx
```

3. Update DNS:
   - In Cloudflare, Route53, or your DNS provider, update the `A` record for `api.getready.example.com` to point to the new server IP.
   - Wait for DNS propagation (TTL 60-300 seconds).

---

### Step 7: Rollback Procedure (If Needed)
If any unexpected failure occurs during migration prior to DNS cutover:
1. Keep the old server running without changes.
2. Revert DNS changes immediately to point back to the original server IP.
3. Diagnose container logs on the new server:

```bash
docker compose -f docker-compose.production.yml logs -f [service-name]
```
