# AWS Production Deployment & Server Operations Guide: GET READY Backend

This document contains the complete architectural specification, setup instructions, automated CI/CD procedures, rollback mechanisms, troubleshooting, and portable server migration runbook for the **Get Ready** microservices backend platform on AWS.

---

## 1. AWS Architecture & Security Overview

```
                      [ DEVELOPER / PUSH TO MAIN ]
                                  │
                                  ▼
                     [ GitHub Actions CI/CD ]
          (OIDC Role: arn:aws:iam::154458646293:role/getready-github-actions)
                                  │
         ┌────────────────────────┴────────────────────────┐
         │ 1. Buildx & Push 12 Microservices               │ 2. Trigger via SSM
         ▼                                                 ▼
[ Amazon ECR Repository ]                       [ AWS Systems Manager (SSM) ]
(154458646293.dkr.ecr.ap-south-1.amazonaws.com/   (AWS-RunShellScript SendCommand)
 getready-backend:<service>-<github-sha>)                  │
                                                           │
                                                           ▼
                                            [ AWS EC2 Instance ]
                                      (i-0a4e7008ca42520d2 / getReady-backend)
                                      (IAM Role: getready-ec2-ecr-role)
                                      (Region: ap-south-1 Mumbai)
                                                           │
                                                           ▼
                                                [ /opt/getready/ ]
                                                ├── docker-compose.production.yml
                                                ├── .env.production
                                                ├── deploy-production.sh
                                                └── health-check.sh
                                                           │
                                                           ▼
                                              [ Docker Engine / Compose ]
```

### Key Security Principles
1. **Zero Long-Lived AWS Credentials in GitHub**: GitHub Actions authenticates with AWS via **GitHub OIDC** assuming `arn:aws:iam::154458646293:role/getready-github-actions`.
2. **Zero SSH Keys in CI/CD**: All remote commands on EC2 are executed securely through **AWS Systems Manager (SSM) SendCommand**.
3. **EC2 IAM Authentication**: The EC2 instance accesses Amazon ECR using instance profile `getready-ec2-ecr-role` (`AmazonEC2ContainerRegistryReadOnly`).
4. **MongoDB Atlas Cloud**: Application data lives on **MongoDB Atlas** via `DATABASE_URI`. No MongoDB Docker container exists on the server.
5. **Private Container Network Isolation**: Only `api-gateway` exposes port `3000` to the host. Redis (`6379`), RabbitMQ (`5672`), Prometheus (`9090`), Grafana (`3000` internal), Loki (`3100`), Promtail (`9080`), and all other 11 microservices (`3001`–`3011`) communicate strictly through the private bridge network `getready-network` and are never exposed directly to the internet.
6. **Immutable SHA Images**: Every deployment uses the exact Git commit SHA that triggered the build.

---

## 2. Infrastructure Inventory & Ports

### AWS Resources
- **Region**: `ap-south-1` (Mumbai)
- **AWS Account ID**: `154458646293`
- **ECR Repository**: `154458646293.dkr.ecr.ap-south-1.amazonaws.com/getready-backend`
- **EC2 Instance ID**: `i-0a4e7008ca42520d2`
- **EC2 Instance Name**: `getReady-backend`
- **EC2 IAM Role**: `getready-ec2-ecr-role`
- **GitHub Actions IAM Role**: `arn:aws:iam::154458646293:role/getready-github-actions`
- **Production Branch**: `main`

### Services & Container Network Map

| Container Name | Role | Host Port | Internal Port | Health Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| `getready-api-gateway` | Public Ingress / Router | `3000` | `3000` | `GET http://127.0.0.1:3000/health` |
| `getready-auth-service` | Authentication & OTP | None | `3001` | `GET http://127.0.0.1:3001/health` |
| `getready-user-service` | Users, Roles, Profiles | None | `3002` | `GET http://127.0.0.1:3002/health` |
| `getready-beautician-service` | Beauticians & Skills | None | `3003` | `GET http://127.0.0.1:3003/health` |
| `getready-catalog-service` | Services & Packages | None | `3004` | `GET http://127.0.0.1:3004/health` |
| `getready-booking-service` | Bookings & Slots | None | `3005` | `GET http://127.0.0.1:3005/health` |
| `getready-cart-service` | Shopping Carts | None | `3006` | `GET http://127.0.0.1:3006/health` |
| `getready-payment-service` | Payments & Finance | None | `3007` | `GET http://127.0.0.1:3007/health` |
| `getready-wallet-service` | Wallets & Balances | None | `3008` | `GET http://127.0.0.1:3008/health` |
| `getready-notification-service` | Push & SMS | None | `3009` | `GET http://127.0.0.1:3009/health` |
| `getready-content-service` | CMS, Blogs, Media | None | `3010` | `GET http://127.0.0.1:3010/health` |
| `getready-worker-service` | Background Jobs & DLQ | None | `3011` | `GET http://127.0.0.1:3011/health` |
| `getready-redis` | Cache & Token Storage | None | `6379` | `redis-cli ping` |
| `getready-rabbitmq` | Message Broker | None | `5672`, `15672` | `rabbitmq-diagnostics ping` |
| `getready-prometheus` | Metrics Collector | None | `9090` | `GET http://127.0.0.1:9090/-/healthy` |
| `getready-grafana` | Monitoring Dashboards | None | `3000` | `GET http://127.0.0.1:3000/api/health` |
| `getready-loki` | Log Aggregator | None | `3100` | `GET http://127.0.0.1:3100/ready` |
| `getready-promtail` | Log Shipper | None | `9080` | `GET http://127.0.0.1:9080/ready` |

---

## 3. Server Directory Layout (`/opt/getready/`)

On the EC2 server, production deployment files live under `/opt/getready/`:

```
/opt/getready/
├── docker-compose.production.yml   # Production Compose file referencing ECR images
├── .env.production                 # Production secrets (NEVER committed to Git)
├── deploy-production.sh            # Safe deployment script with ECR pull & rollback
├── rollback-production.sh          # Standalone manual rollback script
├── health-check.sh                 # Comprehensive health probe for all 18 containers
├── deployment-state.env            # Automatically tracked active & previous image tags
└── monitoring/                     # Configuration files for Prometheus, Grafana, Loki
    ├── prometheus.yml
    ├── loki/
    │   └── loki-config.yml
    ├── promtail/
    │   └── promtail-config.yml
    └── grafana/
        ├── provisioning/
        │   ├── datasources/datasources.yml
        │   └── dashboards/dashboards.yml
        └── dashboards/
            ├── microservices.json
            ├── rabbitmq.json
            ├── system-overview.json
            └── database.json
```

---

## 4. Initial EC2 Server Setup (One-Time)

To prepare an EC2 instance (`i-0a4e7008ca42520d2` or a newly provisioned instance):

### 4.1. Attach IAM Role to EC2
Ensure instance `i-0a4e7008ca42520d2` has IAM role `getready-ec2-ecr-role` attached with policies:
- `AmazonEC2ContainerRegistryReadOnly`
- `AmazonSSMManagedInstanceCore`

### 4.2. Install Prerequisites on EC2 (Ubuntu 22.04 / 24.04 LTS)

Connect to the instance via SSM Session Manager or SSH and execute:

```bash
# 1. Update system packages
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg lsb-release jq unzip

# 2. Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

# 3. Install Docker Engine and Docker Compose Plugin
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Enable Docker service and configure permissions
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
sudo usermod -aG docker ssm-user
```

### 4.3. Initialize Production Directory

```bash
# Create deployment directory
sudo mkdir -p /opt/getready
sudo chown -R ubuntu:ubuntu /opt/getready
cd /opt/getready

# Copy deployment assets from repository deploy/ folder:
# (docker-compose.production.yml, deploy-production.sh, rollback-production.sh, health-check.sh, monitoring/)
```

### 4.4. Configure Production Environment (`.env.production`)

Create `/opt/getready/.env.production` and inject production secrets:

```bash
cat << 'EOF' > /opt/getready/.env.production
NODE_ENV=production
PORT=3000
GATEWAY_PORT=3000
APP_NAME=getready-api-gateway
APP_URL=https://api.getready.example.com
SWAGGER_ENABLED=false

# MongoDB Atlas URI (Strictly process.env.DATABASE_URI)
DATABASE_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/getready_prod?retryWrites=true&w=majority

# Microservices URLs (Internal Docker Network DNS)
AUTH_SERVICE_URL=http://auth-service:3001
USER_SERVICE_URL=http://user-service:3002
BEAUTICIAN_SERVICE_URL=http://beautician-service:3003
CATALOG_SERVICE_URL=http://catalog-service:3004
BOOKING_SERVICE_URL=http://booking-service:3005
CART_SERVICE_URL=http://cart-service:3006
PAYMENT_SERVICE_URL=http://payment-service:3007
WALLET_SERVICE_URL=http://wallet-service:3008
NOTIFICATION_SERVICE_URL=http://notification-service:3009
CONTENT_SERVICE_URL=http://content-service:3010
WORKER_SERVICE_URL=http://worker-service:3011

# RabbitMQ & Redis Credentials
RABBITMQ_USER=admin
RABBITMQ_PASS=your_strong_rabbitmq_password_2026
REDIS_PASSWORD=your_strong_redis_password_2026
REDIS_ENABLED=true
REDIS_HOST=redis
REDIS_PORT=6379

# Observability Credentials
GRAFANA_USER=admin
GRAFANA_PASSWORD=your_strong_grafana_password_2026

# JWT Security (Minimum 32 random characters)
JWT_SECRET=your_cryptographically_secure_jwt_secret_min_32_chars_2026
JWT_REFRESH_SECRET=your_cryptographically_secure_jwt_refresh_secret_min_32_chars_2026
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# CORS Allowed Origins
CORS_ORIGINS=https://admin.getready.example.com,https://www.getready.example.com

# Logging & Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true

# Storage & SMS
AWS_REGION=sgp1
AWS_BUCKET_NAME=getready-production
AWS_ACCESS_KEY_ID=your_storage_access_key
AWS_SECRET_ACCESS_KEY=your_storage_secret_key
AWS_S3_ENDPOINT=https://sgp1.digitaloceanspaces.com
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Payment Gateway
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
EOF

chmod 600 /opt/getready/.env.production
```

---

## 5. First Production Deployment (Manual Execution)

Once the images are pushed to Amazon ECR for a given commit SHA (e.g. `a1b2c3d4e5f6...`):

```bash
cd /opt/getready
chmod +x deploy-production.sh rollback-production.sh health-check.sh

# Run first deployment
./deploy-production.sh a1b2c3d4e5f6...
```

The script will:
1. Log in to ECR via EC2 IAM role.
2. Validate `.env.production` and `DATABASE_URI`.
3. Pull all 12 images (`:service-a1b2c3d4...`).
4. Start Redis, RabbitMQ, Prometheus, Grafana, Loki, Promtail, API Gateway, and 11 downstream microservices.
5. Wait for stabilization and run health checks on all 18 containers.
6. Record active version in `deployment-state.env`.

---

## 6. Automated CI/CD Deployment Flow (GitHub Actions)

### 6.1. Build & Push Pipeline (`.github/workflows/build-and-push.yml`)
- **Trigger**: `git push origin main` or manual `workflow_dispatch`.
- **Action**:
  - Uses GitHub OIDC (`arn:aws:iam::154458646293:role/getready-github-actions`).
  - Concurrently builds all 12 microservice Dockerfiles with Docker Buildx.
  - Tags and pushes:
    `154458646293.dkr.ecr.ap-south-1.amazonaws.com/getready-backend:<service>-${GITHUB_SHA}`
  - Verifies tag existence in ECR.

### 6.2. Production Deployment Pipeline (`.github/workflows/deploy-production.yml`)
- **Trigger**: Automatic on completion of `Build & Push to ECR` on `main`, or manual `workflow_dispatch`.
- **Action**:
  - Assumes AWS OIDC role.
  - Verifies that all 12 images for the exact Git SHA exist in ECR.
  - Dispatches AWS SSM `SendCommand` targeting instance `i-0a4e7008ca42520d2`.
  - Executes `/opt/getready/deploy-production.sh "${GITHUB_SHA}"`.
  - Polls SSM execution status and streams stdout/stderr to GitHub Actions logs.
  - Fails if the script returns a non-zero exit code.

---

## 7. Rollback Procedures

### 7.1. Automated Rollback on Deployment Failure
If any container fails its health probe during deployment:
1. `deploy-production.sh` intercepts the failure.
2. Reads `PREVIOUS_IMAGE_TAG` from `deployment-state.env`.
3. Re-deploys the previous stable containers with `docker compose up -d`.
4. Runs health checks on the rolled-back containers.
5. Updates `deployment-state.env` with `FAILED_AND_ROLLED_BACK`.
6. Exits with code `1` (which fails the SSM command and alerts GitHub Actions).

### 7.2. Manual Emergency Rollback
To roll back manually on EC2 at any time:

```bash
cd /opt/getready

# Roll back to previous recorded version
./rollback-production.sh

# OR roll back to an explicit commit SHA
./rollback-production.sh <target-commit-sha>
```

---

## 8. Health Verification & Monitoring

### 8.1. Run Health Check Script
```bash
cd /opt/getready
./health-check.sh
```

### 8.2. Check Running Containers
```bash
docker compose -f docker-compose.production.yml ps
```

### 8.3. Probe API Gateway Directly
```bash
# Public Liveness Check
curl -s http://127.0.0.1:3000/health | jq .

# End-to-End System Health Aggregator (Probes all downstream services)
curl -s http://127.0.0.1:3000/health/system | jq .
```

---

## 9. Viewing Container Logs

### 9.1. Docker Compose Logs
```bash
cd /opt/getready

# View all logs in real-time
docker compose -f docker-compose.production.yml logs -f

# View specific service logs
docker compose -f docker-compose.production.yml logs -f api-gateway
docker compose -f docker-compose.production.yml logs -f auth-service
docker compose -f docker-compose.production.yml logs -f booking-service
```

### 9.2. Grafana & Loki Log Exploration
- Grafana is accessible internally on port `3000` (`getready-grafana`).
- Loki collects all container stdout/stderr via Promtail.
- To access Grafana remotely without public exposure, use an SSH tunnel or AWS SSM Port Forwarding:

```bash
# SSM Port Forwarding from local workstation to EC2 Grafana
aws ssm start-session \
  --target i-0a4e7008ca42520d2 \
  --document-name AWS-StartPortForwardingSession \
  --parameters '{"portNumber":["3000"],"localPortNumber":["3001"]}' \
  --region ap-south-1
```
Then navigate to `http://localhost:3001/grafana/` in your browser.

---

## 10. Troubleshooting Common Issues

### Issue 1: `ECR Login Failed`
- **Cause**: EC2 instance does not have IAM role attached or role lacks `AmazonEC2ContainerRegistryReadOnly`.
- **Fix**: Verify role attachment in AWS Console or CLI:
  ```bash
  aws sts get-caller-identity
  aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 154458646293.dkr.ecr.ap-south-1.amazonaws.com
  ```

### Issue 2: `SSM Agent Offline / Command Not Dispatched`
- **Cause**: SSM agent is not running or lacks IAM permissions.
- **Fix**: On EC2:
  ```bash
  sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service || sudo systemctl status amazon-ssm-agent
  sudo systemctl restart amazon-ssm-agent
  ```

### Issue 3: `MongoDB Atlas Connection Timeout`
- **Cause**: EC2 public/elastic IP is not whitelisted in MongoDB Atlas Network Access.
- **Fix**: In MongoDB Atlas Dashboard → **Network Access** → Add Current EC2 Public IP or configure AWS VPC Peering.

### Issue 4: `JWT_SECRET Validation Error on Startup`
- **Cause**: `JWT_SECRET` in `.env.production` is missing or shorter than 32 characters.
- **Fix**: Generate a secure 64-character secret with `openssl rand -hex 32` and update `.env.production`.

---

## 11. Portable Server Migration Runbook (9 Steps)

The Get Ready backend is 100% portable and can be migrated to any new EC2 instance or cloud VM with zero application code changes.

### Migration Procedure:
1. **Provision New EC2 Instance**: Launch an Ubuntu 22.04 / 24.04 instance in `ap-south-1`.
2. **Attach IAM Role**: Attach `getready-ec2-ecr-role` to the new instance.
3. **Install Prerequisites**: Run the commands in [Section 4.2](#42-install-prerequisites-on-ec2-ubuntu-2204--2404-lts) (Docker, AWS CLI, SSM Agent).
4. **Create Directory**: `sudo mkdir -p /opt/getready && sudo chown -R ubuntu:ubuntu /opt/getready`.
5. **Copy Deployment Assets**: Copy `docker-compose.production.yml`, `deploy-production.sh`, `rollback-production.sh`, `health-check.sh`, and `monitoring/` to `/opt/getready/`.
6. **Copy Production Secrets**: Securely copy `.env.production` to `/opt/getready/.env.production`.
7. **Whitelist IP in MongoDB Atlas**: Add the new EC2 Public / Elastic IP to MongoDB Atlas Network Access.
8. **Run Initial Deployment**:
   ```bash
   cd /opt/getready
   chmod +x *.sh
   ./deploy-production.sh <latest-git-sha>
   ```
9. **Update DNS / Load Balancer**: Point your domain or Route53 / Application Load Balancer target group to the new EC2 instance.
