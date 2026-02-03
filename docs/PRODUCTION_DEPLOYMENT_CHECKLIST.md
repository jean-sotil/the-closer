# Production Deployment Checklist

**Version**: 1.0
**Last Updated**: 2026-02-02

Complete this checklist before **every** production deployment.

---

## Pre-Deployment Checks

### 1. Code Quality ✅

- [ ] All tests passing (`pnpm test`)
- [ ] TypeScript compilation clean (`pnpm build`)
- [ ] ESLint shows no errors (`pnpm lint`)
- [ ] Code formatted (`pnpm format:check`)
- [ ] No console.log statements in production code
- [ ] No commented-out code blocks
- [ ] No TODO/FIXME comments for critical issues

### 2. Security Audit ✅

- [ ] npm audit shows no high/critical vulnerabilities
- [ ] Snyk scan passed
- [ ] CodeQL analysis passed
- [ ] No hardcoded secrets in codebase
- [ ] All environment variables configured in hosting platform
- [ ] `.env.example` is up to date
- [ ] `.mcp.json` contains no placeholder keys
- [ ] Security headers configured in production
- [ ] CORS whitelist updated for production domain
- [ ] Rate limiting enabled
- [ ] Account lockout mechanism active
- [ ] Password strength enforcement enabled

### 3. Database ✅

- [ ] All migrations applied to production database
- [ ] Row Level Security (RLS) policies active on all tables
- [ ] Backup verification completed (last 7 days)
- [ ] Data retention policies configured
- [ ] Database indexes optimized
- [ ] Connection pooling configured
- [ ] No test data in production database

### 4. API & Integrations ✅

- [ ] Supabase project ID updated for production
- [ ] Supabase anon key configured
- [ ] Supabase service key secured
- [ ] Mailgun domain verified and DNS configured
- [ ] Mailgun API key valid
- [ ] Google Calendar credentials configured (if enabled)
- [ ] VAPI API key configured (if enabled)
- [ ] All third-party API endpoints using production URLs

### 5. Frontend Build ✅

- [ ] Production build succeeds (`pnpm build`)
- [ ] Build size under limits (< 500KB per chunk)
- [ ] Sourcemaps generated
- [ ] Environment variables using VITE_ prefix
- [ ] No development-only code in build
- [ ] Asset optimization enabled (minification, compression)
- [ ] Cache-busting headers configured

### 6. Monitoring & Logging ✅

- [ ] Error monitoring configured (Sentry DSN set)
- [ ] Performance monitoring enabled
- [ ] Security event logging active
- [ ] Application logs forwarding to logging service
- [ ] Uptime monitoring configured (e.g., UptimeRobot, Pingdom)
- [ ] Status page created (e.g., status.thecloser.ai)
- [ ] Alert thresholds configured
- [ ] On-call rotation defined

### 7. Performance ✅

- [ ] Lighthouse score > 90 (Performance)
- [ ] Lighthouse score > 90 (Accessibility)
- [ ] Lighthouse score > 90 (Best Practices)
- [ ] Lighthouse score > 90 (SEO)
- [ ] Core Web Vitals meet targets:
  - [ ] LCP < 2.5s
  - [ ] FID < 100ms
  - [ ] CLS < 0.1
- [ ] API response times < 200ms (p95)
- [ ] Database query times < 100ms (p95)

### 8. Security Headers ✅

Verify headers using https://securityheaders.com:

- [ ] `Strict-Transport-Security` (HSTS)
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Content-Security-Policy` with strict directives
- [ ] `Permissions-Policy` restricting dangerous features

### 9. HTTPS & DNS ✅

- [ ] SSL/TLS certificate valid and not expiring soon
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] DNS records configured correctly
- [ ] CDN configured (if using)
- [ ] Domain ownership verified
- [ ] www redirect configured
- [ ] Certificate auto-renewal enabled

### 10. Compliance & Legal ✅

- [ ] Privacy Policy published and accessible
- [ ] Terms of Service published and accessible
- [ ] Cookie consent banner functional (if required)
- [ ] GDPR compliance verified (if serving EU users)
- [ ] CCPA compliance verified (if serving CA users)
- [ ] CAN-SPAM compliance (unsubscribe links in emails)
- [ ] Data retention policies documented
- [ ] Right to erasure procedures in place

---

## Deployment Process

### 11. Pre-Deployment ✅

- [ ] Create deployment branch from main
- [ ] Tag release version (e.g., v1.0.0)
- [ ] Update CHANGELOG.md
- [ ] Notify team of deployment window
- [ ] Schedule deployment during low-traffic period
- [ ] Create rollback plan
- [ ] Backup current production database

### 12. Deployment ✅

- [ ] Deploy to staging environment first
- [ ] Run smoke tests on staging
- [ ] Verify all features work on staging
- [ ] Check security headers on staging
- [ ] Test authentication flows on staging
- [ ] Deploy to production
- [ ] Monitor deployment logs for errors
- [ ] Clear CDN cache (if applicable)

### 13. Post-Deployment Verification ✅

**Immediate (0-5 minutes):**
- [ ] Homepage loads successfully
- [ ] Login works
- [ ] API endpoints responding
- [ ] Database connections healthy
- [ ] No 500 errors in logs
- [ ] Error rate < 0.1%

**Short-term (5-30 minutes):**
- [ ] User registration works
- [ ] Lead discovery functional
- [ ] Email sending works
- [ ] Payment processing works (if applicable)
- [ ] All critical user flows functional
- [ ] Performance metrics normal
- [ ] No memory leaks detected

**Long-term (30 minutes - 24 hours):**
- [ ] Monitor error rates
- [ ] Check performance dashboards
- [ ] Review security logs
- [ ] Verify scheduled jobs running
- [ ] Check email delivery rates
- [ ] Monitor database performance
- [ ] Watch for unusual traffic patterns

### 14. Rollback Procedure (If Needed) ✅

If critical issues are detected:

1. **Immediate Response (0-5 minutes)**
   - [ ] Notify team in #incidents channel
   - [ ] Start incident log
   - [ ] Assess severity (P0-P4)

2. **Rollback Decision (5-15 minutes)**
   - [ ] Can issue be hotfixed quickly? → Yes: hotfix; No: rollback
   - [ ] Is data at risk? → Yes: immediate rollback
   - [ ] Are users affected? → Yes: evaluate urgency

3. **Execute Rollback (15-30 minutes)**
   - [ ] Revert to previous Git tag
   - [ ] Redeploy previous version
   - [ ] Verify rollback successful
   - [ ] Notify users of incident
   - [ ] Update status page

4. **Post-Rollback (30+ minutes)**
   - [ ] Root cause analysis
   - [ ] Document incident
   - [ ] Create fix plan
   - [ ] Schedule remediation
   - [ ] Review and improve process

---

## Security Incident Response

### If Security Breach Detected 🚨

**Immediate Actions (0-1 hour):**
- [ ] Isolate affected systems
- [ ] Preserve evidence (logs, database dumps)
- [ ] Notify security team
- [ ] Assess scope of breach
- [ ] Change all compromised credentials

**Short-term (1-24 hours):**
- [ ] Investigate root cause
- [ ] Identify affected users
- [ ] Patch vulnerability
- [ ] Notify affected users (within 72 hours per GDPR)
- [ ] Notify authorities if required

**Long-term (24+ hours):**
- [ ] Full security audit
- [ ] Implement additional safeguards
- [ ] Update security documentation
- [ ] Conduct post-mortem
- [ ] Improve monitoring

---

## Monitoring Dashboards

### Key Metrics to Watch

**Application Health:**
- Error rate (target: < 0.1%)
- Response time (target: p95 < 200ms)
- Uptime (target: 99.5%+)
- Active users
- API rate limit violations

**Business Metrics:**
- Leads discovered per day
- Emails sent per day
- Email open rate (target: > 20%)
- Meeting booking rate (target: > 3%)
- Conversion rate

**Security Metrics:**
- Failed login attempts
- Account lockouts
- Rate limit violations
- Suspicious traffic patterns
- Security event counts

---

## Contact Information

**Deployment Lead**: [Name] - [Email]
**Security Lead**: [Name] - security@thecloser.ai
**Database Admin**: [Name] - [Email]
**On-Call Engineer**: [See PagerDuty rotation]

**Emergency Contacts:**
- Supabase Support: https://supabase.com/support
- Vercel Support: https://vercel.com/support
- Mailgun Support: https://www.mailgun.com/support

---

## Sign-Off

**Deployed By**: ______________________ **Date**: __________

**Reviewed By**: ______________________ **Date**: __________

**Approved By**: ______________________ **Date**: __________

---

## Post-Deployment Notes

Use this space to document any issues, workarounds, or observations during deployment:

```
Deployment #:
Date/Time:
Version:
Issues Encountered:
Resolutions:
Follow-up Actions:
```

---

**Template Version**: 1.0
**Next Review**: 2026-08-02 (6 months)
