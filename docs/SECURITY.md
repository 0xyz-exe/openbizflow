# OpenBizFlow Security Model

## 1. Multi-Tenancy & Authorization
- Every resource (workflows, executions, node outputs, credentials, approvals) is strictly scoped to an `organization_id`.
- Handlers authenticate users via JWT and enforce membership verification before fulfilling requests.
- Cross-tenant requests return `403 Forbidden` and do not leak data across workspaces.

## 2. Server-Side Request Forgery (SSRF) Protection
- HTTP Request nodes validate destination hostnames prior to socket connection.
- Private IP spaces (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), and cloud metadata services (`169.254.169.254`) are blocked by default.
- Only HTTP and HTTPS schemes are supported; file/gopher/ftp protocols are rejected.

## 3. Cryptography & Secret Handling
- User passwords are encrypted with salted `bcrypt`.
- Third-party API keys and SMTP passwords are encrypted at rest using Fernet authenticated symmetric encryption.
- Encrypted secrets are never echoed back in REST responses (`****` masking).

## 4. Webhook Replay & HMAC Validation
- Incoming webhooks support HMAC-SHA256 signature verification.
- Idempotency keys (`X-Idempotency-Key`) ensure duplicate deliveries return cached responses rather than duplicating operations.
