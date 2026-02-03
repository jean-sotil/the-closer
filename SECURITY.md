# Security Policy

## Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Instead, please report security vulnerabilities by emailing: security@thecloser.ai

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and provide a timeline for fixing the issue.

---

## Security Measures

### Authentication & Authorization

- **Supabase Auth**: JWT-based authentication with automatic token refresh
- **Password Requirements**:
  - Minimum 8 characters
  - Must include uppercase, lowercase, numbers, and special characters
- **Account Lockout**: 5 failed attempts = 15-minute lockout
- **Rate Limiting**: 5 login attempts per 15 minutes
- **Session Management**: 24-hour sessions with auto-refresh

### API Security

- **Rate Limiting**: 60 requests/minute for API endpoints
- **Input Validation**: Zod schemas on all inputs
- **XSS Prevention**: Input sanitization and Content Security Policy
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **CORS Configuration**: Whitelist of allowed origins

### Database Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Encryption**: TLS for all connections
- **Backups**: Automated daily backups via Supabase
- **Least Privilege**: Service role used only for admin operations

### Infrastructure Security

- **HTTPS Only**: All production traffic over TLS 1.3
- **Security Headers**:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Content-Security-Policy` with strict directives
  - `Strict-Transport-Security` (HSTS) in production
- **Dependency Scanning**: npm audit + Snyk on every commit
- **Code Scanning**: CodeQL static analysis

---

## Secrets Management

### Environment Variables

All secrets must be stored in environment variables, never in code.

**Required Secrets:**
```bash
# Supabase
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY

# Mailgun
MAILGUN_API_KEY
MAILGUN_DOMAIN

# Google Calendar (optional)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN

# VAPI (optional)
VAPI_API_KEY
```

### Rotation Policy

**Critical Secrets** (Database, Auth):
- Rotate every 90 days
- Immediate rotation if exposed

**API Keys** (Mailgun, Calendar):
- Rotate every 180 days
- Immediate rotation if exposed

### Rotation Procedure

1. Generate new secret in provider dashboard
2. Update secret in production environment
3. Deploy updated configuration
4. Verify new secret works
5. Revoke old secret
6. Document rotation in change log

### Storage

- **Development**: `.env` file (gitignored)
- **CI/CD**: GitHub Secrets
- **Production**: Environment variables in hosting platform
- **Local Testing**: `.env.local` (gitignored)

### Access Control

- Only lead developers have access to production secrets
- Secrets are never logged or displayed in UI
- API errors are sanitized before display
- Audit log for all secret access (planned)

---

## Compliance

### CAN-SPAM Act

- Unsubscribe link in all emails
- Honor unsubscribe requests within 10 days
- Accurate sender information
- Clear subject lines

### GDPR / CCPA

- Data retention policy: 365 days
- Right to erasure: Contact support
- Data export: Available via API
- Privacy policy: [Link to policy]

### OWASP Top 10

Regular audits against OWASP Top 10:
- ✅ A01: Broken Access Control (RLS enabled)
- ✅ A02: Cryptographic Failures (Supabase encryption)
- ✅ A03: Injection (Parameterized queries)
- ✅ A04: Insecure Design (Rate limiting, lockout)
- ⚠️  A05: Security Misconfiguration (In progress)
- ✅ A06: Vulnerable Components (npm audit)
- ⚠️  A07: Auth Failures (Lockout added, MFA planned)
- ⚠️  A08: Data Integrity (CSRF in progress)
- ⚠️  A09: Logging Failures (Monitoring planned)
- ✅ A10: SSRF (Not applicable)

---

## Incident Response

### Detection

- Automated monitoring for security events
- Anomaly detection on auth attempts
- Rate limit violation alerts
- Dependency vulnerability alerts

### Response Team

1. **Security Lead**: Reviews and triages
2. **DevOps**: Infrastructure response
3. **Engineering**: Code fixes
4. **Legal**: Compliance and disclosure

### Response Timeline

- **Critical** (Data breach): 1 hour response, 24 hour fix
- **High** (Auth bypass): 4 hour response, 48 hour fix
- **Medium** (XSS, CSRF): 24 hour response, 1 week fix
- **Low** (Info disclosure): 48 hour response, 2 week fix

### Post-Incident

1. Root cause analysis
2. Implement fixes
3. Update security measures
4. Document lessons learned
5. Notify affected users (if required by law)

---

## Security Checklist for Deployments

Before each production deployment:

- [ ] All dependencies up to date
- [ ] npm audit shows no high/critical issues
- [ ] Snyk scan passes
- [ ] CodeQL analysis passes
- [ ] All environment variables configured
- [ ] HTTPS certificates valid
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Database RLS policies active
- [ ] Backup verification completed
- [ ] Monitoring dashboards operational
- [ ] Incident response team notified

---

## Security Training

All developers must complete:
- OWASP Top 10 training (annually)
- Secure coding practices (quarterly)
- Social engineering awareness (annually)
- Incident response simulation (bi-annually)

---

## Third-Party Security

### Vendors

All third-party services must:
- Be SOC 2 Type II certified
- Have public security documentation
- Support HTTPS/TLS 1.3
- Provide security incident notifications
- Allow data export and deletion

### Current Vendors

- **Supabase**: SOC 2 Type II, ISO 27001
- **Mailgun**: SOC 2 Type II
- **Vercel** (hosting): SOC 2 Type II, ISO 27001
- **GitHub** (CI/CD): SOC 2 Type II

---

## Contact

For security questions or concerns:
- Email: security@thecloser.ai
- PGP Key: [Link to public key]
- Bug Bounty: [Link to program] (coming soon)

---

*Last Updated: 2026-02-02*
*Security Policy Version: 1.0*
