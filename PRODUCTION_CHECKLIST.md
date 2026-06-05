# Production deployment checklist

The app is configured entirely via environment variables (`.env`, loaded by
docker-compose). `.env` is gitignored — never commit it. Copy `env.template`
and fill it in for production.

## 1. Generate strong secrets
```bash
# SECRET_KEY (JWT signing) and a random admin password
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(48))"
# ENCRYPTION_KEY must be a urlsafe-base64 32-byte key
python -c "import base64,os; print('ENCRYPTION_KEY=' + base64.urlsafe_b64encode(os.urandom(32)).decode())"
# POSTGRES_PASSWORD
python -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_urlsafe(24))"
```

## 2. Settings that MUST change from the dev values
| Variable | Dev | Production |
|---|---|---|
| `DEBUG` | `true` | **`false`** (also turns off SQL echo) |
| `ENVIRONMENT` | `development` | `production` |
| `COOKIE_SECURE` | `false` | **`true`** (HTTPS only) |
| `SECRET_KEY` | placeholder | strong random (above) |
| `ENCRYPTION_KEY` | placeholder | strong random (above) |
| `POSTGRES_PASSWORD` | `postgres` | strong random |
| `SINGLE_HOSTNAME` | `localhost` | your real domain |
| `APP_URL` / `FRONTEND_URL` | localhost | `https://<your-domain>` |
| `ALLOWED_ORIGINS` | localhost | `https://<your-domain>` |
| `INITIAL_ADMIN_EMAIL` / `_PASSWORD` | demo | your real admin (change the password after first login) |

## 3. Email (already configured for SMTP/Mailcow)
`SMTP_HOST/PORT/USER/PASSWORD/USE_TLS/USE_SSL`, `FROM_EMAIL`, `FROM_NAME`,
`SUPPORT_EMAIL` are set in `.env`. For deliverability (so signing links don't
land in spam), add DNS records for the `FROM_EMAIL` domain:
- **SPF**: authorize the Mailcow host to send for the domain.
- **DKIM**: publish the Mailcow DKIM public key.
- **DMARC**: a `_dmarc` policy record.

## 4. Document-signing certificate
By default the app auto-generates a **self-signed** PKCS#12 at
`certs/vistasign_cert.p12` on first start (signatures are cryptographically
valid but not chained to a trusted CA). For CA-trusted signatures, provide your
own and point `SIGNATURE_CERT_PATH` / `SIGNATURE_PASSWORD` at it. `certs/` is
gitignored.

## 5. TLS / hosting
docker-compose terminates HTTP at nginx (port 80) and expects TLS in front
(ALB / reverse proxy). Terminate HTTPS at your load balancer or re-enable the
certbot service in `docker-compose.yml`.

## 6. Bring it up
```bash
docker compose up -d --build         # db, redis, backend, worker, nginx
docker compose exec -T backend python scripts/smoke_test.py   # sanity check
```
Do NOT publish the `db`, `redis`, or `backend` ports to the host in production —
only nginx (80) should be exposed. (The local `docker-compose.override.yml`
publishes them for development only and is gitignored.)
