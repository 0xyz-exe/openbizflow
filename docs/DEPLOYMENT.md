# OpenBizFlow Deployment Guide

## Docker Compose Quickstart

Clone repository and configure environment variables:
```bash
cp .env.example .env
docker compose up --build -d
```

Services started:
- `web`: Frontend UI at `http://localhost:3000`
- `api`: FastAPI backend at `http://localhost:8000`
- `postgres`: PostgreSQL 16 on port `5434`
- `redis`: Redis 7 on port `6380`

## Production Configuration
1. Generate unique secrets:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
2. Update `SECRET_KEY` and `ENCRYPTION_KEY` in `.env`.
3. Set `ALLOW_PRIVATE_IPS="false"` to maintain SSRF protection.
4. Set up an SSL terminating reverse proxy (Caddy or Nginx) in front of port 3000.
