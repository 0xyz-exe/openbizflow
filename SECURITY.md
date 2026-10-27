# Security Policy

## Supported Versions
| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Controls
- **Tenant Isolation**: Every database query verifies organization membership via server-side session checks.
- **SSRF Protection**: Outgoing HTTP request nodes validate hostnames against private RFC-1918 networks, loopback addresses, and cloud metadata endpoints.
- **Credential Storage**: Credentials are encrypted at rest using Fernet authenticated cryptography and are masked (`****`) in all client responses.
- **Signature Verification**: Webhooks enforce HMAC-SHA256 signature validation with timing-safe comparison.

## Reporting a Vulnerability
Please report security vulnerabilities responsibly by opening a confidential security advisory on GitHub or emailing the maintainers. Do not disclose vulnerabilities publicly before a fix is released.
