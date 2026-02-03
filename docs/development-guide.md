# The Closer - Development Guide

**Version**: 1.0
**Last Updated**: February 3, 2026

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Running Tests](#running-tests)
5. [Code Style Guidelines](#code-style-guidelines)
6. [Git Workflow & Pull Requests](#git-workflow--pull-requests)
7. [Debugging Tips](#debugging-tips)
8. [Common Issues](#common-issues)

---

## Local Development Setup

### Prerequisites

Ensure you have the following installed:

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | ≥20.0.0 | [nodejs.org](https://nodejs.org) or via `nvm` |
| pnpm | ≥9.0.0 | `npm install -g pnpm` |
| Git | ≥2.30 | [git-scm.com](https://git-scm.com) |

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/the-closer.git
cd the-closer
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This installs all dependencies for:
- Root workspace
- Dashboard app (`apps/dashboard/`)
- MCP packages (`packages/mcp-*/`)

### Step 3: Configure Environment Variables

Create environment files:

```bash
# Root .env (for MCP servers)
cp .env.example .env

# Dashboard .env (for frontend)
cp apps/dashboard/.env.example apps/dashboard/.env
```

Edit the files with your credentials:

**Root `.env`:**
```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_KEY="your-service-key"  # Optional
MAILGUN_API_KEY="your-mailgun-key"
MAILGUN_DOMAIN="mail.yourdomain.com"
```

**`apps/dashboard/.env`:**
```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### Step 4: Set Up Local Database (Optional)

For local development with Supabase:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (requires Docker)
supabase start

# Apply migrations
supabase db push
```

Local Supabase URLs (after `supabase start`):
- API URL: `http://localhost:54321`
- Studio: `http://localhost:54323`
- Anon Key: Displayed in terminal output

### Step 5: Start Development Server

```bash
# Start the dashboard (default)
pnpm dev

# Or explicitly
pnpm --filter dashboard dev
```

The dashboard will be available at `http://localhost:5173`.

---

## Project Structure

```
the-closer/
├── apps/
│   └── dashboard/              # React frontend application
│       ├── src/
│       │   ├── components/     # Reusable UI components
│       │   │   ├── leads/      # Lead management components
│       │   │   ├── campaigns/  # Campaign components
│       │   │   └── ui/         # Base UI components
│       │   ├── pages/          # Route pages
│       │   │   ├── Audits.tsx
│       │   │   ├── Discovery.tsx
│       │   │   ├── Leads.tsx
│       │   │   ├── Login.tsx
│       │   │   ├── Outreach.tsx
│       │   │   ├── Settings.tsx
│       │   │   └── Signup.tsx
│       │   ├── contexts/       # React contexts (AuthContext)
│       │   ├── hooks/          # Custom React hooks
│       │   ├── api/            # API client layer
│       │   ├── config/         # Configuration
│       │   └── utils/          # Utility functions
│       ├── tests/
│       │   ├── e2e/            # Playwright E2E tests
│       │   └── load/           # K6 load tests
│       └── public/             # Static assets
├── packages/
│   ├── mcp-lead-discovery/     # Google Maps scraping MCP
│   ├── mcp-site-audit/         # Website auditing MCP
│   ├── mcp-email-outreach/     # Mailgun email MCP
│   └── mcp-lead-storage/       # Supabase CRUD MCP
├── supabase/
│   └── migrations/             # Database migrations
├── docs/                       # Documentation
├── .env.example                # Environment template
├── .prettierrc                 # Prettier config
├── eslint.config.js            # ESLint config
├── package.json                # Root package.json
├── pnpm-workspace.yaml         # pnpm workspace config
└── tsconfig.json               # TypeScript config
```

---

## Development Workflow

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dashboard dev server |
| `pnpm build` | Build all packages for production |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Run ESLint with auto-fix |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run unit tests with Vitest |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |

### MCP Server Scripts

```bash
# Start Lead Discovery MCP
pnpm discovery:start -- --query "dentists in Austin"

# Start Site Audit MCP
pnpm audit:start -- --status pending --limit 50

# Start Email Outreach MCP
pnpm email:start
```

### Pre-Commit Checklist

Before committing, run:

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
```

---

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test

# Watch mode (re-runs on file changes)
pnpm test:watch

# With coverage report
pnpm test:coverage
```

Coverage reports are generated in `coverage/`.

### E2E Tests (Playwright)

E2E tests are located in `apps/dashboard/tests/e2e/`.

```bash
# Navigate to dashboard
cd apps/dashboard

# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npx playwright test

# Run in headed mode (visible browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/e2e/auth.setup.ts

# Open Playwright UI
npx playwright test --ui
```

**Test Files:**
- `auth.setup.ts` - Authentication setup
- `discovery-audit.spec.ts` - Discovery to audit flow
- `audit-campaign.spec.ts` - Audit to campaign flow
- `campaign-booking.spec.ts` - Campaign to booking flow
- `error-scenarios.spec.ts` - Error handling tests
- `visual-regression.spec.ts` - Visual regression tests

### Load Tests (K6)

```bash
# Install K6 (macOS)
brew install k6

# Run dashboard load test
cd apps/dashboard/tests/load
k6 run dashboard-load.js

# Run audit throughput test
k6 run audit-throughput.js
```

---

## Code Style Guidelines

### ESLint Configuration

The project uses ESLint with TypeScript support. Key rules:

**TypeScript Rules:**
- `@typescript-eslint/explicit-function-return-type`: Require return types
- `@typescript-eslint/no-explicit-any`: Disallow `any` type
- `@typescript-eslint/no-unused-vars`: Error on unused variables (prefix with `_` to ignore)
- `@typescript-eslint/no-floating-promises`: Must handle promises
- `@typescript-eslint/prefer-nullish-coalescing`: Use `??` over `||`
- `@typescript-eslint/prefer-optional-chain`: Use `?.` for optional chaining

**Import Ordering:**
```typescript
// 1. Built-in modules
import { readFile } from "fs";

// 2. External packages
import React from "react";
import { useQuery } from "@tanstack/react-query";

// 3. Internal modules
import { supabase } from "@/api/supabase";

// 4. Parent/sibling imports
import { Button } from "../ui/Button";
import { useAuth } from "./useAuth";

// 5. Index imports
import "./styles.css";

// 6. Type imports
import type { Lead } from "@/types";
```

**General Rules:**
- No `console.log` (use `console.warn` or `console.error`)
- Prefer `const` over `let`
- Use strict equality (`===`)

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "es5",
  "printWidth": 80,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Component Guidelines

**File Naming:**
- Components: `PascalCase.tsx` (e.g., `LeadTable.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useLeads.ts`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `PascalCase.ts` or in `types.ts`

**Component Structure:**
```typescript
// 1. Imports
import React, { useState } from "react";

import { Button } from "@/components/ui";
import { useLeads } from "@/hooks/useLeads";

import type { Lead } from "@/types";

// 2. Types
interface LeadCardProps {
  lead: Lead;
  onSelect: (id: string) => void;
}

// 3. Component
export function LeadCard({ lead, onSelect }: LeadCardProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  // 4. Event handlers
  const handleClick = (): void => {
    onSelect(lead.id);
    setIsExpanded(!isExpanded);
  };

  // 5. Render
  return (
    <div onClick={handleClick}>
      <h3>{lead.business_name}</h3>
      {isExpanded && <p>{lead.address}</p>}
    </div>
  );
}
```

---

## Git Workflow & Pull Requests

### Branch Naming

```
feature/  - New features (feature/add-calendar-integration)
fix/      - Bug fixes (fix/login-redirect-loop)
refactor/ - Code refactoring (refactor/leads-api)
docs/     - Documentation (docs/add-api-reference)
test/     - Test additions (test/e2e-campaign-flow)
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `test`: Test additions/changes
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(leads): add bulk status update functionality

- Added checkbox selection to lead table
- Implemented bulk update API call
- Added success/error toast notifications

Closes #123
```

```bash
fix(auth): resolve redirect loop on expired session

The session check was not properly clearing
stale tokens before redirecting to login.
```

### Pull Request Template

```markdown
## Summary

Brief description of the changes.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests pass (`pnpm test`)
- [ ] E2E tests pass (`npx playwright test`)
- [ ] Manually tested on local environment

## Screenshots (if applicable)

## Checklist

- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review
- [ ] I have added tests for my changes
- [ ] All new and existing tests pass
- [ ] I have updated the documentation (if needed)
```

### PR Review Process

1. **Create PR** - Push branch and open PR against `main`
2. **CI Checks** - Ensure all CI checks pass
3. **Review** - Request review from team member
4. **Address Feedback** - Make requested changes
5. **Approval** - Get at least 1 approval
6. **Merge** - Squash and merge to `main`

---

## Debugging Tips

### React DevTools

Install the [React Developer Tools](https://react.dev/learn/react-developer-tools) browser extension to inspect component state and props.

### Network Debugging

Open browser DevTools → Network tab to inspect API calls.

Common issues:
- **401 Unauthorized**: Check if JWT token is expired
- **403 Forbidden**: Check RLS policies in Supabase
- **CORS errors**: Verify domain is in Supabase CORS settings

### Supabase Debugging

```typescript
// Enable Supabase client logging
const supabase = createClient(url, key, {
  db: { schema: "public" },
  auth: { debug: true },
});
```

View Supabase logs:
- Local: `supabase logs`
- Cloud: Supabase Dashboard → Logs

### VS Code Extensions

Recommended extensions for this project:
- **ESLint** - Linting integration
- **Prettier** - Code formatting
- **TypeScript Importer** - Auto-import suggestions
- **Tailwind CSS IntelliSense** - Tailwind autocomplete
- **Playwright Test** - E2E test integration

---

## Common Issues

### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

### TypeScript errors after pulling

```bash
# Regenerate TypeScript cache
pnpm typecheck
```

### Vite dev server not hot-reloading

```bash
# Restart dev server
# Press Ctrl+C then:
pnpm dev
```

### Database connection issues

1. Check `VITE_SUPABASE_URL` matches your project
2. Verify anon key is correct
3. Check if Supabase project is paused (free tier)

### Playwright tests failing

```bash
# Update Playwright browsers
npx playwright install

# Run with debug mode
npx playwright test --debug
```

### ESLint "parsing error"

Ensure `tsconfig.json` includes the file being linted:

```json
{
  "include": ["src/**/*", "tests/**/*"]
}
```

---

## Getting Help

- **Documentation**: Check `docs/` folder
- **Team Chat**: `#the-closer-dev` Slack channel
- **Issues**: GitHub Issues for bug reports
- **Code Review**: Tag `@team-leads` for complex PRs

---

**Document Version**: 1.0
**Last Updated**: February 3, 2026
**Maintained By**: Engineering Team
