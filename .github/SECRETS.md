# Required GitHub Secrets

Configure these secrets in your repository settings under **Settings > Secrets and variables > Actions**.

## Required Secrets

### Vercel Deployment

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `VERCEL_TOKEN` | Vercel API token | [Vercel Tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | Vercel organization ID | Run `vercel link` locally |
| `VERCEL_PROJECT_ID` | Vercel project ID | Run `vercel link` locally |

### Supabase (Staging)

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard > Settings > API |
| `SUPABASE_PROJECT_REF` | Project reference ID | From Supabase URL (e.g., `abc123` from `abc123.supabase.co`) |
| `SUPABASE_ACCESS_TOKEN` | Personal access token for CLI | [Supabase Access Tokens](https://app.supabase.com/account/tokens) |

### Supabase (Production)

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `SUPABASE_URL_PROD` | Production Supabase URL | Same as staging, different project |
| `SUPABASE_ANON_KEY_PROD` | Production anon key | Same as staging, different project |
| `SUPABASE_PROJECT_REF_PROD` | Production project ref | Same as staging, different project |

### Testing

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `TEST_USER_EMAIL` | Test user email for E2E | Create a test user in Supabase Auth |
| `TEST_USER_PASSWORD` | Test user password | Password for test user |
| `CODECOV_TOKEN` | Codecov upload token | [Codecov](https://codecov.io) |

### Notifications (Optional)

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook | [Slack Apps](https://api.slack.com/apps) |

### Security Scanning (Optional)

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `SNYK_TOKEN` | Snyk API token | [Snyk Account](https://app.snyk.io/account) |

## Environment Setup

### Local Development

Create a `.env.local` file in `apps/dashboard/`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Vercel Link

Run these commands to link your Vercel project:

```bash
# Install Vercel CLI
pnpm add -g vercel

# Link project (creates .vercel folder)
cd apps/dashboard
vercel link

# The org_id and project_id will be in .vercel/project.json
cat .vercel/project.json
```

### Supabase CLI Setup

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

## GitHub Environments

Configure these environments in **Settings > Environments**:

### `staging`
- No required reviewers
- Deployment branch: `main`

### `production`
- Required reviewers: 1+ team members
- Deployment branch: tags only (or `main` with approval)
- Environment secrets: Use `*_PROD` variants

## Workflow Permissions

Ensure your repository has the following permissions enabled:

1. Go to **Settings > Actions > General**
2. Under "Workflow permissions", select:
   - "Read and write permissions"
   - "Allow GitHub Actions to create and approve pull requests"
