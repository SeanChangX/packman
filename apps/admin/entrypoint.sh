#!/bin/sh
set -e

ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
ADMIN_API_SECRET="${ADMIN_API_SECRET:-}"

if [ "$ADMIN_PASSWORD" = "changeme" ]; then
  echo "[WARN] ADMIN_PASSWORD is using default. Set a strong password in .env"
fi

if [ -z "$ADMIN_API_SECRET" ]; then
  echo "[ERROR] ADMIN_API_SECRET must be set in .env"
  exit 1
fi

# Generate basic auth credentials
htpasswd -bc /etc/nginx/.htpasswd "$ADMIN_USER" "$ADMIN_PASSWORD"
echo "[INFO] Basic auth configured for user: $ADMIN_USER"

# Inject the API secret into nginx config at runtime
sed -i "s|__ADMIN_API_SECRET__|${ADMIN_API_SECRET}|g" /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
