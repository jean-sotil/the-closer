# Changelog

All notable changes to The Closer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Features that have been added but not yet released

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Features that have been removed

### Fixed
- Bug fixes

### Security
- Security-related changes

---

## [1.0.0] - 2026-02-03

### Added
- Initial release of The Closer
- Lead Discovery: Google Maps scraping with network interception
- Site Auditor: Lighthouse performance, accessibility, and coverage analysis
- Evidence Generation: Screenshots, videos, and reports
- Lead Management: Full CRUD with filtering, sorting, and bulk actions
- Email Outreach: Multi-step campaigns with Mailgun integration
- Campaign Analytics: Open rates, click rates, booking tracking
- User Authentication: Supabase Auth with JWT
- Dashboard: React + TypeScript + Vite frontend
- Database: Supabase PostgreSQL with Row Level Security
- Documentation: Architecture, API reference, deployment, and user guides

### Security
- Row Level Security (RLS) on all database tables
- Strong password enforcement (8+ chars, mixed case, numbers, symbols)
- Rate limiting (60 req/min API, 5 req/15min auth)
- Account lockout after 5 failed login attempts
- Security headers (HSTS, CSP, X-Frame-Options)
- Input sanitization and XSS prevention

---

## Version History Template

When releasing a new version, copy this template:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature description (#issue-number)

### Changed
- Change description (#issue-number)

### Fixed
- Bug fix description (#issue-number)

### Security
- Security fix description (#issue-number)
```

---

## Release Process

1. Update version in `package.json`
2. Add entry to this changelog
3. Create git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
4. Push tag: `git push origin vX.Y.Z`
5. Create GitHub release with changelog entry

---

[Unreleased]: https://github.com/your-org/the-closer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/the-closer/releases/tag/v1.0.0
