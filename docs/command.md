# GetReady Backend — Docker Command Reference (Development & Production)

Comprehensive guide for building, starting, managing, debugging, and tearing down all GetReady Backend microservices using Docker Compose.

---

## 📁 Pre-requisites & Setup

Always run these commands from the `Backend` directory:
```bash
cd c:\projects\GR\Backend
```

Ensure the appropriate environment configuration file is present:
- **Development:** `.env.development`
- **Production:** `.env.production`

---

## 🛠️ 1. Development Environment (`docker-compose.dev.yml`)

The development stack enables hot-reloading (volume-mounted source code), live brokers (RabbitMQ, Redis, Elasticsearch), observability (Prometheus, Grafana, Loki), and connects to MongoDB Atlas.

### Quick NPM Scripts
```bash
# Start all dev services in background
npm run docker:dev

# Stop all dev services
npm run docker:dev:down

# Rebuild dev container images
npm run docker:build
```

### Native Docker Compose Commands

#### 🚀 Build & Start
```bash
# Start all microservices in the background (detached mode)
docker compose -f docker-compose.dev.yml up -d

# Force rebuild all images and start with fresh containers
docker compose -f docker-compose.dev.yml up -d --build --force-recreate

# Start only infrastructure dependencies first (Redis, RabbitMQ, Elasticsearch)
docker compose -f docker-compose.dev.yml up -d redis rabbitmq elasticsearch

# Start a specific microservice (e.g., api-gateway, booking-service)
docker compose -f docker-compose.dev.yml up -d api-gateway
docker compose -f docker-compose.dev.yml up -d catalog-service
docker compose -f docker-compose.dev.yml up -d beautician-service
```

#### 📊 Status & Health Monitoring
```bash
# View status and ports of all dev containers
docker compose -f docker-compose.dev.yml ps

# View live container resource consumption (CPU, Memory, Network I/O)
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

#### 📜 Logs & Debugging
```bash
# Stream live logs from all services simultaneously
docker compose -f docker-compose.dev.yml logs -f

# Stream logs from a specific service with last 100 lines
docker compose -f docker-compose.dev.yml logs -f --tail=100 api-gateway
docker compose -f docker-compose.dev.yml logs -f --tail=100 booking-service
docker compose -f docker-compose.dev.yml logs -f --tail=100 catalog-service

# Stream logs with timestamps
docker compose -f docker-compose.dev.yml logs -f -t
```

#### 🔄 Restarting Services
```bash
# Restart all containers
docker compose -f docker-compose.dev.yml restart

# Restart an individual service without stopping others
docker compose -f docker-compose.dev.yml restart api-gateway
docker compose -f docker-compose.dev.yml restart catalog-service
docker compose -f docker-compose.dev.yml restart booking-service
```

#### 🛑 Stopping & Teardown
```bash
# Stop and remove containers and networks (keeps volume data intact)
docker compose -f docker-compose.dev.yml down

# Stop and wipe ALL data volumes (Redis, RabbitMQ, Elasticsearch data reset)
docker compose -f docker-compose.dev.yml down -v

# Stop containers without removing them
docker compose -f docker-compose.dev.yml stop

# Resume stopped containers
docker compose -f docker-compose.dev.yml start
```

---

## 🚀 2. Production Environment (`docker-compose.prod.yml`)

The production stack builds optimized, hardened multi-stage production images with strict resource limits (CPUs, Memory quotas), healthchecks, restart policies (`restart: always`), and `.env.production` configs.

### Quick NPM Scripts
```bash
# Start all production services in background
npm run docker:prod

# Stop all production services
npm run docker:prod:down
```

### Native Docker Compose Commands

#### 🏗️ Build Production Images
```bash
# Clean build all production images targeting multi-stage 'production'
docker compose -f docker-compose.prod.yml build --no-cache

# Build images in parallel
docker compose -f docker-compose.prod.yml build
```

#### 🚀 Launch Production Stack
```bash
# Start all production microservices in background
docker compose -f docker-compose.prod.yml up -d

# Build and start in one command
docker compose -f docker-compose.prod.yml up -d --build

# Scale a specific stateless worker or service (e.g. 2 instances of worker-service)
docker compose -f docker-compose.prod.yml up -d --scale worker-service=2
```

#### 🔄 Zero-Downtime Service Update (Rolling Upgrade)
```bash
# Rebuild and reload a single service without stopping the rest of the application:
docker compose -f docker-compose.prod.yml up -d --no-deps --build catalog-service
docker compose -f docker-compose.prod.yml up -d --no-deps --build booking-service
docker compose -f docker-compose.prod.yml up -d --no-deps --build api-gateway
```

#### 📊 Monitoring & Logs
```bash
# View all production containers and their health status
docker compose -f docker-compose.prod.yml ps

# Check logs of all production services
docker compose -f docker-compose.prod.yml logs -f --tail=200

# Check logs of API Gateway (ingress)
docker compose -f docker-compose.prod.yml logs -f --tail=200 api-gateway
```

#### 🛑 Stopping Production Stack
```bash
# Graceful shutdown of all production services
docker compose -f docker-compose.prod.yml down

# Stop without removing containers
docker compose -f docker-compose.prod.yml stop
```

---

## 🔧 3. Container Inspection & Shell Access

Enter any running container for debugging database connectivity, environment variables, or package paths:

```bash
# Open interactive shell in a container
docker exec -it getready-dev-api-gateway sh
docker exec -it getready-dev-catalog-service sh
docker exec -it getready-dev-booking-service sh
docker exec -it getready-dev-auth-service sh

# Check environment variables inside container
docker exec -it getready-dev-api-gateway env

# Test MongoDB Atlas connectivity from inside a container
docker exec -it getready-dev-catalog-service node -e "const m = require('mongoose'); m.connect(process.env.DATABASE_URI, { family: 4, serverSelectionTimeoutMS: 5000 }).then(() => console.log('CONNECTED')).catch(e => console.error(e.message));"

# Inspect detailed Docker healthcheck status
docker inspect --format='{{json .State.Health}}' getready-dev-api-gateway
docker inspect --format='{{json .State.Health}}' getready-dev-catalog-service
```

---

## 🧹 4. Docker Clean-up & Maintenance

If you experience high disk usage, cache staleness, or container lockups:

```bash
# Remove stopped containers, dangling images, and unused networks
docker system prune -f

# Deep cleanup: remove ALL unused images (not just dangling) and build cache
docker system prune -a --volumes -f

# View Docker disk space consumption
docker system df
```

---

## 🩺 5. Troubleshooting (Windows / WSL2 Specific)

If `docker` CLI commands hang or container network cannot reach external MongoDB Atlas:

1. **Named Pipe / WSL Hang Fix:**
   Open PowerShell and shutdown the WSL virtual machine:
   ```powershell
   wsl --shutdown
   ```
2. **Restart Docker Desktop:**
   Right-click the Docker Desktop tray icon and click **Restart**, or launch:
   ```powershell
   Start-Process 'C:\Users\HP\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe'
   ```
3. **Verify Engine Readiness:**
   ```powershell
   docker version
   docker ps
   ```
