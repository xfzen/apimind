# Security Policy

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Use the repository's private security-advisory reporting channel when available, or contact the maintainers through the project's established private channel. Include affected versions, reproduction steps, impact, and any proposed mitigation.

Maintainers will acknowledge the report, assess scope, and coordinate a fix and disclosure timeline. Please do not access data that is not yours, disrupt services, or publish exploit details before a coordinated disclosure.

## Security boundaries

ApiMind Web is an untrusted browser client. Secrets, remote-service credentials, authorization decisions, data persistence, and calls to remote ApiMind/YApi/business systems belong in the Go service. Production artifacts must be built from the locked dependency tree and served from the generated `dist/`; the runtime container contains only Nginx and those static files.
