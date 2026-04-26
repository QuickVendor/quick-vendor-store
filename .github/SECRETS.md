# GitHub Actions Secrets

Configure these secrets in **GitHub → Settings → Secrets and variables → Actions → New repository secret** before the pipeline will work.

| Secret | Where to get it | Used in |
|--------|----------------|---------|
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions — no setup needed | GHCR authentication (login-action), Gitleaks secret scanning |

## Notes

- `GITHUB_TOKEN` is injected automatically by GitHub for every workflow run. You do not create it.
- Never paste actual secret values into any file in this repository. Always use the GitHub Secrets UI.

## Deployment Strategy

Railway is connected directly to the GitHub repository and deploys
automatically on every push to `main`. No Railway token or project ID
is required in GitHub secrets. GitHub Actions is responsible for CI
and Docker image builds only.
