# Quick Vendor — Infrastructure Design

## Server Specs (Hetzner CPX22)

| Spec | Value |
|------|-------|
| vCPU | 2 AMD |
| RAM | 4GB |
| Storage | 80GB NVMe SSD |
| Traffic | 20TB/mo |

---

## High-Level Architecture

Frontends (Next.js storefront + admin) deploy to **Vercel**.
Backend (NestJS), database, and monitoring run on the **Hetzner VPS** as Docker containers across two environments (production + staging).

```
Vercel
├── store.quickvendor.store           ← Next.js storefront (prod)
├── admin.quickvendor.store           ← Admin panel (prod)
├── staging.store.quickvendor.store   ← storefront (staging)
└── staging.admin.quickvendor.store   ← admin (staging)

Hetzner CPX22 (4GB RAM / 2 vCPU)
│
├── Nginx                           ← reverse proxy + SSL (Let's Encrypt)
│
├── [shared-infra]
│   ├── PostgreSQL                  ← single instance, 2 databases
│   └── cAdvisor                    ← monitors ALL containers
│
├── [prod]
│   ├── nestjs-prod                 ← api.quickvendor.store
│   └── prometheus-prod             ← scrapes prod targets + cAdvisor (filtered)
│
├── [staging]
│   ├── nestjs-staging              ← staging.api.quickvendor.store
│   └── prometheus-staging          ← scrapes staging targets + cAdvisor (filtered)
│
└── [monitoring-ui]
    └── Grafana                     ← grafana.quickvendor.store (auth-gated)
        ├── Data Source: prometheus-prod
        └── Data Source: prometheus-staging
```

---

## Resource Estimates

| Container | Est. RAM | Notes |
|-----------|----------|-------|
| Nginx | ~30MB | Shared, reverse proxy |
| NestJS (prod) | ~200MB | |
| NestJS (staging) | ~150MB | Resource-capped |
| PostgreSQL (shared) | ~250MB | 2 databases in 1 instance |
| cAdvisor (shared) | ~80MB | Reads Docker socket, sees all containers |
| Prometheus (prod) | ~150MB | 30-day retention |
| Prometheus (staging) | ~100MB | 7-day retention, memory-capped |
| Grafana (shared) | ~120MB | 2 data sources, folder-separated dashboards |
| **Total** | **~1.1GB** | **Leaves ~2.5GB headroom on 4GB** |

---

## Why Smart Separation Over Full Duplication

### The cAdvisor Problem

cAdvisor reads from the Docker socket — it sees **all containers on the host** regardless of which compose stack owns them. Running two instances gives identical data twice, wasting ~80MB for nothing.

### Grafana Duplication Is Wasteful

Two Grafana instances would serve the same dashboards with different data sources. A single Grafana with two Prometheus data sources and folder-separated dashboards achieves the same result.

### Comparison

| | Smart Separation | Full Duplication |
|---|---|---|
| RAM usage | ~1.1GB | ~1.6GB |
| cAdvisor | 1 (correct) | 2 (identical data, wasteful) |
| Grafana | 1 (2 data sources) | 2 (same dashboards twice) |
| Prometheus | 2 (filtered per env) | 2 (filtered per env) |
| True env isolation | Yes, via labels | Same, just more RAM |

---

## Database Strategy

Single PostgreSQL instance with two databases:

```
PostgreSQL container
├── quickvendor_prod
└── quickvendor_staging
```

- Saves ~250MB vs running two Postgres containers
- Isolation is at the database level (separate credentials per env)
- Can always split into two containers later if needed

---

## Per-Environment Prometheus Filtering

### Container Labeling

```yaml
# prod/docker-compose.yml
services:
  nestjs:
    labels:
      env: "prod"

# staging/docker-compose.yml
services:
  nestjs:
    labels:
      env: "staging"
```

### Prometheus Config (prod example)

```yaml
# prometheus-prod.yml
scrape_configs:
  - job_name: 'nestjs'
    static_configs:
      - targets: ['nestjs-prod:3001']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
    metric_relabel_configs:
      - source_labels: [container_label_env]
        regex: 'prod'
        action: keep    # drops all metrics not labeled "prod"
```

Staging Prometheus uses the same pattern with `regex: 'staging'`.

---

## Resource Limits

### Staging (capped to protect prod)

```yaml
# staging/docker-compose.yml
services:
  nestjs:
    mem_limit: 256m
    cpus: 0.5

  prometheus:
    mem_limit: 128m
    command:
      - '--storage.tsdb.retention.time=7d'
      - '--storage.tsdb.retention.size=500MB'
```

### Prod (more headroom)

```yaml
# prod/docker-compose.yml
services:
  nestjs:
    mem_limit: 512m
    cpus: 1.0

  prometheus:
    mem_limit: 256m
    command:
      - '--storage.tsdb.retention.time=30d'
      - '--storage.tsdb.retention.size=2GB'
```

---

## Docker Network Layout

```yaml
networks:
  prod:         # nestjs-prod + prometheus-prod + postgres
  staging:      # nestjs-staging + prometheus-staging + postgres
  monitoring:   # cadvisor + both prometheus instances + grafana
  proxy:        # nginx + nestjs-prod + nestjs-staging + grafana
```

- PostgreSQL and cAdvisor sit on multiple networks
- Staging containers **cannot** reach prod containers directly
- Grafana only accessible through the proxy network

---

## Folder Structure on VPS

```
/opt/quickvendor/
├── prod/
│   ├── docker-compose.yml
│   └── .env
├── staging/
│   ├── docker-compose.yml
│   └── .env
├── monitoring/
│   ├── docker-compose.yml
│   ├── prometheus-prod.yml
│   ├── prometheus-staging.yml
│   └── grafana/
│       └── provisioning/
│           └── datasources.yml
├── shared/
│   └── docker-compose.yml       ← postgres + cadvisor
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       ├── prod.conf
│       ├── staging.conf
│       └── monitoring.conf
└── certbot/
    └── ...                      ← Let's Encrypt SSL certs
```

---

## Grafana Setup

Single instance with two data sources and folder-separated dashboards:

```yaml
# grafana/provisioning/datasources.yml
apiVersion: 1
datasources:
  - name: Prometheus-Prod
    type: prometheus
    url: http://prometheus-prod:9090
    isDefault: true

  - name: Prometheus-Staging
    type: prometheus
    url: http://prometheus-staging:9091
```

Dashboard folders:
- `Production/` — dashboards using Prometheus-Prod
- `Staging/` — dashboards using Prometheus-Staging

---

## Nginx Routing

| Domain | Target |
|--------|--------|
| `api.quickvendor.store` | `nestjs-prod:3001` |
| `staging.api.quickvendor.store` | `nestjs-staging:4001` |
| `grafana.quickvendor.store` | `grafana:3000` (auth-gated) |

SSL via Certbot/Let's Encrypt with auto-renewal cron.

NestJS backend must allow CORS from Vercel frontend domains.

---

## Backup Strategy

- **Hetzner snapshots** — weekly full server snapshot
- **pg_dump cron** — daily dump of `quickvendor_prod` database
- **Offsite** — sync dumps to Hetzner Object Storage or external S3

---

## CI/CD Flow

1. Push to `main` → GitHub Actions → SSH deploy to **staging** on VPS
2. Verify on staging
3. Manual approval / tag → deploy to **prod** on VPS
4. Vercel auto-deploys frontends from the same branches

---

## Scaling Path (When You Outgrow CPX22)

1. **Vertical** — upgrade to CPX32 (8GB / 4 vCPU) on Hetzner, minimal config changes
2. **Split monitoring** — move Prometheus + Grafana to a separate cheap VPS
3. **Managed DB** — move PostgreSQL to Hetzner Managed Database, free up ~250MB + remove backup burden
4. **Separate servers** — dedicated VPS per environment when traffic justifies it

---

## Migration Guide: Single Server → Two Servers

When revenue justifies it, you'll split into two dedicated servers. This section is a step-by-step playbook.

### Target Architecture (After Migration)

```
Server A — PRODUCTION (CPX22 or CPX32)
├── Nginx
├── nestjs-prod
├── postgres (quickvendor_prod only)
├── prometheus-prod
├── grafana (prod dashboards only)
└── cadvisor

Server B — STAGING (CPX22 / cheapest tier)
├── Nginx
├── nestjs-staging
├── postgres (quickvendor_staging only)
├── prometheus-staging
├── grafana (staging dashboards only)
└── cadvisor
```

Each server becomes self-contained. No cross-server container networking needed.

### When to Migrate

Pull the trigger when you see **any** of these:
- Prod RAM consistently above 70% (check Grafana)
- Staging deploys cause prod latency spikes
- You need to load-test staging without risking prod
- Revenue covers ~€10/mo extra for a second server

### Pre-Migration Checklist

- [ ] Both compose stacks already work independently (they should — you built them as separate stacks)
- [ ] CI/CD deploys via SSH to a configurable host (not hardcoded IP)
- [ ] DNS TTL lowered to 300s (5 min) at least 24 hours before migration
- [ ] Full `pg_dump` backup of both databases taken and verified
- [ ] Hetzner snapshot of current single server as rollback safety net

### Step-by-Step Migration

#### Phase 1: Provision Server B (Staging) — ~30 min

```bash
# 1. Create new Hetzner CPX22 (or cheaper CX22 for staging)
#    Note the new IP address: <STAGING_IP>

# 2. SSH in and install Docker + Docker Compose
ssh root@<STAGING_IP>
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# 3. Create directory structure
mkdir -p /opt/quickvendor/{staging,monitoring,shared,nginx,certbot}

# 4. Copy staging configs from old server
# (from your local machine or old server)
scp -r root@<OLD_IP>:/opt/quickvendor/staging/ root@<STAGING_IP>:/opt/quickvendor/
scp -r root@<OLD_IP>:/opt/quickvendor/monitoring/ root@<STAGING_IP>:/opt/quickvendor/
scp -r root@<OLD_IP>:/opt/quickvendor/nginx/ root@<STAGING_IP>:/opt/quickvendor/
```

#### Phase 2: Migrate Staging Database — ~15 min

```bash
# On OLD server: dump staging database
docker exec postgres pg_dump -U quickvendor -d quickvendor_staging > staging_dump.sql

# Copy to new server
scp staging_dump.sql root@<STAGING_IP>:/opt/quickvendor/

# On NEW server: start postgres and restore
cd /opt/quickvendor/shared
docker compose up -d postgres

docker exec -i postgres psql -U quickvendor -d quickvendor_staging < /opt/quickvendor/staging_dump.sql
```

#### Phase 3: Start Staging on Server B — ~15 min

```bash
# On Server B:

# 1. Update staging .env to point to local postgres
#    DATABASE_URL=postgresql://quickvendor:xxx@postgres:5432/quickvendor_staging

# 2. Update prometheus config — remove prod targets, keep only staging
#    Edit /opt/quickvendor/monitoring/prometheus-staging.yml

# 3. Update nginx config — only staging domains
#    Edit /opt/quickvendor/nginx/conf.d/staging.conf

# 4. Bring everything up
cd /opt/quickvendor/shared && docker compose up -d
cd /opt/quickvendor/staging && docker compose up -d
cd /opt/quickvendor/monitoring && docker compose up -d
cd /opt/quickvendor/nginx && docker compose up -d

# 5. Verify staging API responds
curl http://localhost:4001/health
```

#### Phase 4: Update DNS — ~5 min

```
staging.api.quickvendor.store  →  A record  →  <STAGING_IP>
staging.grafana.quickvendor.store  →  A record  →  <STAGING_IP>
```

Wait for DNS propagation (5 min if you lowered TTL earlier).

#### Phase 5: Clean Up Old Server (Now Prod-Only) — ~15 min

```bash
# On Server A (old server):

# 1. Stop staging containers
cd /opt/quickvendor/staging && docker compose down

# 2. Remove staging database from shared postgres
docker exec postgres psql -U quickvendor -c "DROP DATABASE quickvendor_staging;"

# 3. Remove staging prometheus config
rm /opt/quickvendor/monitoring/prometheus-staging.yml

# 4. Update Grafana — remove staging data source
#    Edit grafana/provisioning/datasources.yml, remove Prometheus-Staging

# 5. Update nginx — remove staging server blocks
#    Remove /opt/quickvendor/nginx/conf.d/staging.conf

# 6. Restart monitoring and nginx
cd /opt/quickvendor/monitoring && docker compose down && docker compose up -d
cd /opt/quickvendor/nginx && docker compose restart

# 7. Remove staging directory
rm -rf /opt/quickvendor/staging

# 8. Reclaim docker resources
docker system prune -a
```

#### Phase 6: Update CI/CD — ~10 min

```yaml
# .github/workflows/deploy.yml
# Change from:
#   STAGING_HOST: <OLD_IP>
#   PROD_HOST: <OLD_IP>
# To:
#   STAGING_HOST: <STAGING_IP>    # Server B
#   PROD_HOST: <OLD_IP>           # Server A (unchanged)
```

#### Phase 7: Verify Everything — ~15 min

```bash
# Test prod (Server A)
curl https://api.quickvendor.store/health
curl https://grafana.quickvendor.store        # should show prod only

# Test staging (Server B)
curl https://staging.api.quickvendor.store/health
curl https://staging.grafana.quickvendor.store  # should show staging only

# Test frontends still connect (Vercel → correct APIs)
# Visit store.quickvendor.store, staging.store.quickvendor.store
```

### Rollback Plan

If anything goes wrong mid-migration:

1. Point `staging.api.quickvendor.store` DNS back to `<OLD_IP>`
2. Restart staging containers on old server: `cd /opt/quickvendor/staging && docker compose up -d`
3. Everything is back to single-server setup within minutes
4. The old server snapshot is your nuclear option — restore from Hetzner console

### Total Migration Time

| Phase | Time |
|-------|------|
| Provision Server B | ~30 min |
| Migrate staging DB | ~15 min |
| Start staging on Server B | ~15 min |
| Update DNS | ~5 min |
| Clean up old server | ~15 min |
| Update CI/CD | ~10 min |
| Verify | ~15 min |
| **Total** | **~2 hours** |

### What Changes, What Doesn't

| | Before | After |
|---|---|---|
| Prod API URL | `api.quickvendor.store` | `api.quickvendor.store` (same) |
| Staging API URL | `staging.api.quickvendor.store` | `staging.api.quickvendor.store` (same) |
| Vercel frontends | No change | No change |
| Prod `.env` | No change | No change |
| Staging `.env` | `DATABASE_URL` points to shared postgres | `DATABASE_URL` points to local postgres |
| CI/CD | Both deploy to same IP | Different IPs per environment |
| Grafana | 1 instance, 2 data sources | 2 instances, 1 data source each |

**Zero downtime for prod.** Users won't notice. Staging has a few minutes of downtime during DNS switch.
