
```markdown
# CI/CD Pipeline Agent — Quick Vendor

You are a senior DevOps engineer tasked with building a complete GitHub 
Actions CI/CD pipeline for Quick Vendor. The pipeline must ensure that 
only clean, tested, secure code ever reaches Railway staging.

---

## Project Structure

```
quick-vendor/
├── quick-vendor-nestjs-backend/     ← NestJS 11 backend
├── quick-vendor-store-front/        ← Next.js 16 storefront
├── quick-vendor-admin/              ← Next.js 16 admin panel
└── .github/
    └── workflows/                   ← Pipeline files go here
```

Each sub-project is independent with its own package.json and yarn.lock.
All projects use TypeScript strict mode and Yarn as the package manager.

---

## Deployment Strategy

**Current setup:**
- `main` branch → triggers pipeline → deploys to Railway staging
- Production environment does not exist yet — do not configure prod deployment
- Images are pushed to GitHub Container Registry (GHCR)
- Railway watches GHCR and auto-deploys when a new image is pushed

**Registry:**
- `ghcr.io/GITHUB_USERNAME/quickvendor-backend`
- `ghcr.io/GITHUB_USERNAME/quickvendor-storefront`
- `ghcr.io/GITHUB_USERNAME/quickvendor-admin`

Replace GITHUB_USERNAME with the actual GitHub username from the 
repository context.

---

## Pipeline Overview

```
Push to main
      ↓
Job 1: Lint & Type Check (all services in parallel)
      ↓ (only if Job 1 passes)
Job 2: Test (backend unit tests)
      ↓ (only if Job 2 passes)
Job 3: Security Scan (dependencies + secrets)
      ↓ (only if Job 3 passes)
Job 4: Build & Push Images (all services in parallel)
      ↓ (only if Job 4 passes)
Job 5: Deploy to Railway Staging
```

Every job depends on the previous one passing. A failure at any stage 
stops the pipeline. Nothing broken reaches Railway.

---

## Workflow Files to Create

Create three workflow files:

1. `.github/workflows/ci.yml` — runs on every push and PR (lint, test, scan)
2. `.github/workflows/cd.yml` — runs on push to main only (build, push, deploy)
3. `.github/workflows/pr.yml` — runs on every pull request (lint, test, scan only — no deploy)

---

## Job 1 — Lint and Type Check

Run for all three services in parallel using a matrix strategy.

```yaml
strategy:
  matrix:
    service:
      - quick-vendor-nestjs-backend
      - quick-vendor-store-front
      - quick-vendor-admin
```

**Steps for each service:**
1. Checkout code
2. Setup Node 20
3. Cache yarn dependencies (use yarn.lock hash as cache key)
4. Install dependencies with `yarn install --frozen-lockfile`
5. Run ESLint: `yarn lint`
6. Run TypeScript type check: `yarn type-check`

**Cache pattern:**
```yaml
- uses: actions/cache@v4
  with:
    path: |
      **/node_modules
      ~/.yarn/cache
    key: yarn-${{ matrix.service }}-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      yarn-${{ matrix.service }}-
```

---

## Job 2 — Unit Tests (Backend Only)

Run unit tests for the NestJS backend only. Storefront and admin 
have no tests yet.

**Steps:**
1. Checkout code
2. Setup Node 20
3. Restore yarn cache
4. Install dependencies
5. Run tests with coverage: `yarn test:cov`
6. Upload coverage report as artifact

**Coverage artifact:**
```yaml
- uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: quick-vendor-nestjs-backend/coverage/
    retention-days: 7
```

**Note:** Do not fail the pipeline on coverage thresholds yet — 
coverage reporting only. Thresholds can be added later when test 
coverage is more established.

---

## Job 3 — Security Scan

Three security checks must all pass:

### 3a. Dependency Audit
Check all three services for known vulnerabilities in dependencies.

```yaml
- name: Audit backend dependencies
  working-directory: quick-vendor-nestjs-backend
  run: yarn audit --level high
  continue-on-error: false

- name: Audit storefront dependencies  
  working-directory: quick-vendor-store-front
  run: yarn audit --level high
  continue-on-error: false

- name: Audit admin dependencies
  working-directory: quick-vendor-admin
  run: yarn audit --level high
  continue-on-error: false
```

### 3b. Secret Scanning
Scan the entire repository for hardcoded secrets, API keys, 
passwords, and tokens.

```yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3c. Dockerfile Security Lint
Lint all Dockerfiles for security best practices using Hadolint.

```yaml
- name: Lint backend Dockerfile
  uses: hadolint/hadolint-action@v3.1.0
  with:
    dockerfile: quick-vendor-nestjs-backend/Dockerfile

- name: Lint storefront Dockerfile
  uses: hadolint/hadolint-action@v3.1.0
  with:
    dockerfile: quick-vendor-store-front/Dockerfile

- name: Lint admin Dockerfile
  uses: hadolint/hadolint-action@v3.1.0
  with:
    dockerfile: quick-vendor-admin/Dockerfile
```

---

## Job 4 — Build and Push Images

Build all three Docker images and push to GHCR in parallel using 
a matrix strategy.

**Authentication:**
```yaml
- name: Login to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

**Image tagging strategy:**
Each image gets two tags:
- `latest` — always points to the most recent build
- Short SHA — `ghcr.io/USER/SERVICE:abc1234` for traceability

```yaml
tags: |
  ghcr.io/${{ github.repository_owner }}/quickvendor-${{ matrix.service }}:latest
  ghcr.io/${{ github.repository_owner }}/quickvendor-${{ matrix.service }}:${{ github.sha }}
```

**Build optimisation — use Docker layer caching:**
```yaml
- uses: docker/setup-buildx-action@v3

- uses: docker/build-push-action@v5
  with:
    context: ./${{ matrix.service-path }}
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    target: production
```

**After building, scan each image for CVEs with Trivy:**
```yaml
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/${{ github.repository_owner }}/quickvendor-${{ matrix.service }}:${{ github.sha }}
    severity: CRITICAL,HIGH
    exit-code: 1
    ignore-unfixed: true
```

Fail the pipeline if any CRITICAL or HIGH CVEs are found that 
have available fixes.

---

## Job 5 — Deploy to Railway Staging

Trigger Railway deployment after all images are pushed successfully.

**Use Railway CLI to trigger deployment:**
```yaml
- name: Install Railway CLI
  run: npm install -g @railway/cli

- name: Deploy backend to staging
  run: railway up --service quickvendor-backend --detach
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

- name: Deploy storefront to staging
  run: railway up --service quickvendor-storefront --detach
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

- name: Deploy admin to staging
  run: railway up --service quickvendor-admin --detach
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

**Required GitHub Secrets:**
- `RAILWAY_TOKEN` — Railway API token from Railway dashboard

---

## PR Workflow (pr.yml)

Runs on every pull request targeting main.
Runs lint, type check, tests, and security scan only.
Never builds images or deploys on a PR.

```yaml
on:
  pull_request:
    branches:
      - main
```

This gives developers fast feedback on their PR without 
wasting build minutes on images that may not merge.

---

## GitHub Secrets Required

Document all secrets that must be configured in the GitHub 
repository settings before the pipeline works:

| Secret | Where to get it | Used in |
|--------|----------------|---------|
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | GHCR auth, Gitleaks |
| `RAILWAY_TOKEN` | Railway dashboard → Account Settings → Tokens | Deploy job |

Write a `SECRETS.md` file in `.github/` documenting each secret, 
what it does, and where to find it. Never put actual secret values 
in any file.

---

## Pipeline Optimisations

Apply these optimisations to keep the pipeline fast:

1. **Dependency caching** — cache node_modules per service using 
   yarn.lock hash. Cache hit should skip yarn install entirely.

2. **Docker layer caching** — use GitHub Actions cache for Docker 
   layers. Unchanged layers are never rebuilt.

3. **Path filtering** — only trigger service-specific jobs when 
   files in that service directory change:
```yaml
on:
  push:
    paths:
      - 'quick-vendor-nestjs-backend/**'
      - 'quick-vendor-store-front/**'
      - 'quick-vendor-admin/**'
      - '.github/workflows/**'
```

4. **Parallel execution** — lint and build jobs use matrix strategy 
   to run all three services simultaneously, not sequentially.

5. **Fail fast** — if one service fails lint, stop the entire matrix 
   immediately:
```yaml
strategy:
  fail-fast: true
  matrix:
    ...
```

---

## Order of Work

Complete in this exact order:

1. Create `.github/workflows/` directory
2. Write `pr.yml` — PR checks workflow
3. Write `ci.yml` — full CI workflow (lint, test, scan)
4. Write `cd.yml` — CD workflow (build, push, deploy)
5. Write `.github/SECRETS.md` — secrets documentation
6. Write `.github/PIPELINE.md` — pipeline documentation explaining 
   each job, what it does, and why it exists
7. Verify all workflow files are valid YAML
8. Run final checklist

---

## Final Checklist

Before declaring the task complete verify:

- [ ] Pipeline only triggers on push to main and PRs targeting main
- [ ] Jobs run in correct dependency order
- [ ] No job deploys on a PR — staging deploy only on main push
- [ ] All three services linted and type checked
- [ ] Backend unit tests run with coverage report uploaded
- [ ] Dependency audit runs for all three services
- [ ] Secret scanning configured
- [ ] Dockerfile linting configured
- [ ] Images tagged with both latest and commit SHA
- [ ] Trivy CVE scan runs after each image build
- [ ] Railway deployment only triggers after all images pass CVE scan
- [ ] Docker layer caching configured for faster builds
- [ ] Dependency caching configured for faster installs
- [ ] Path filtering configured to avoid unnecessary runs
- [ ] RAILWAY_TOKEN documented in SECRETS.md
- [ ] No actual secret values in any file
- [ ] All workflow YAML is valid

---

## How to Report Issues

If anything blocks the pipeline setup, report it clearly:

**Format:**
- **File:** which workflow file has the issue
- **Job:** which job is affected
- **Severity:** Critical / High / Medium / Low
- **Issue:** what the problem is
- **Fix:** exact resolution

Do not proceed past a Critical issue without resolving it first.
```

---
