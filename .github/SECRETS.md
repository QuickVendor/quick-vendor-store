# GitHub Actions Secrets

Configure these secrets in **GitHub → Settings → Secrets and variables → Actions → New repository secret** before the pipeline will work.

| Secret | Where to get it | Used in |
|--------|----------------|---------|
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions — no setup needed | GHCR authentication (login-action), Gitleaks secret scanning |
| `RAILWAY_TOKEN` | Railway dashboard → Account Settings → Tokens → New Token | Deploy job in `cd.yml` |

## Notes

- `GITHUB_TOKEN` is injected automatically by GitHub for every workflow run. You do not create it.
- `RAILWAY_TOKEN` must be a **team-scoped** or **project-scoped** token with deploy permissions. Generate it at [railway.app](https://railway.app) under your account settings.
- Never paste actual secret values into any file in this repository. Always use the GitHub Secrets UI.
