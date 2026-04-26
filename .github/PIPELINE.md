# CI/CD Pipeline

Three workflow files control the pipeline for Quick Vendor.

## Workflows

### `pr.yml` — Pull Request Checks
Triggers on every pull request targeting `main` (path-filtered to relevant directories).

Gives developers fast feedback before merge. Never builds images or deploys.

### `ci.yml` — Continuous Integration
Triggers on push to `main` (path-filtered). This is the gate that must pass before CD runs.

### `cd.yml` — Continuous Deployment
Triggers via `workflow_run` after the CI workflow completes successfully on `main`. Only fires when CI passes — a failed CI blocks deployment automatically.

---

## Job Flow

```
Push to main
      ↓
[CI workflow]
Job 1: lint-type-check  ← runs all 3 services in parallel (matrix)
      ↓ (fails fast if any service fails)
Job 2: test             ← backend unit tests + coverage upload
      ↓
Job 3: security-scan    ← dep audit + secret scan + Dockerfile lint
      ↓
[CD workflow triggers via workflow_run]
Job 4: build-push       ← builds all 3 Docker images in parallel, Trivy CVE scan per image
      ↓ (fails fast if any image has unfixed CRITICAL CVEs)
[Railway]
Detects push to main and deploys all 3 services to staging automatically.
```

---

## Job Details

### Job 1 — Lint & Type Check
- Runs for `quick-vendor-nestjs-backend`, `quick-vendor-store-front`, `quick-vendor-admin` in parallel using a matrix strategy.
- `fail-fast: true` — if one service fails, the other matrix jobs are cancelled immediately.
- Yarn dependencies are cached per-service using the yarn.lock hash. A cache hit skips `yarn install` entirely.

### Job 2 — Unit Tests (Backend Only)
- Runs the NestJS backend test suite with coverage (`yarn test:cov`).
- Coverage report is uploaded as a GitHub Actions artifact (retained 7 days). No coverage threshold is enforced yet.
- Storefront and admin have no tests yet — they are excluded from this job.

### Job 3 — Security Scan
Three checks must all pass:
1. **Dependency audit** — `yarn audit --level high` for each service. Fails on any high-severity vulnerability with a known fix.
2. **Secret scanning** — Gitleaks scans the full git history for hardcoded secrets, API keys, and tokens.
3. **Dockerfile linting** — Hadolint checks all three Dockerfiles against security best practices (non-root users, pinned base images, etc.).

### Job 4 — Build & Push Images
- Builds all three Docker images in parallel (matrix with `include`).
- Images are pushed to GitHub Container Registry (GHCR) under `ghcr.io/QuickVendor/`.
- Each image gets two tags: `latest` and the full commit SHA for traceability.
- Docker layer caching via GitHub Actions cache (`type=gha`) speeds up rebuilds — unchanged layers are never rebuilt.
- After pushing, Trivy scans each image for CVEs. HIGH findings are surfaced informationally (visible in the run log, non-blocking). The pipeline fails only on CRITICAL CVEs with an available fix.

**Image targets by service:**
| Service | Dockerfile stage |
|---------|-----------------|
| `quick-vendor-nestjs-backend` | `production` |
| `quick-vendor-store-front` | `runner` |
| `quick-vendor-admin` | `runner` |

**GHCR image names:**
- `ghcr.io/QuickVendor/quickvendor-backend`
- `ghcr.io/QuickVendor/quickvendor-storefront`
- `ghcr.io/QuickVendor/quickvendor-admin`

### Deployment — Railway

Railway is connected directly to the GitHub repository (Project → Settings → Source) and watches `main`. On every push that lands, Railway pulls the latest commit and deploys all three services to the staging environment automatically. GitHub Actions does not run any `railway up` command and no Railway token is needed in GitHub Secrets — the pipeline's responsibility ends at pushing the Docker images to GHCR.

---

## Optimisations

| Optimisation | How |
|-------------|-----|
| Dependency caching | `actions/cache@v4` keyed on yarn.lock hash per service |
| Docker layer caching | `cache-from/cache-to: type=gha` in `build-push-action` |
| Parallel lint/build | Matrix strategy across all three services simultaneously |
| Path filtering | Workflows only trigger when relevant files change |
| Fail fast | `fail-fast: true` on matrix — one failure cancels the rest |
| No wasted build minutes on PRs | `pr.yml` never builds images or deploys |

---

## Secrets Required

See `SECRETS.md` for setup instructions.
