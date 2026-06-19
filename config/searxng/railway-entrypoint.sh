#!/bin/sh
# Renders settings.yml from the template on every boot (Railway containers
# don't persist /etc/searxng between deploys the way the docker-compose
# named volume does), then hands off to the upstream entrypoint, which
# drops privileges to the `searxng` user before starting the server.
set -eu

secret="${SEARXNG_SECRET:-}"
if [ -z "$secret" ]; then
  echo "railway-entrypoint: SEARXNG_SECRET not set, generating an ephemeral one" >&2
  secret="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
fi

sed "s|__SEARXNG_SECRET__|$secret|g" /etc/searxng/settings.yml.template > /etc/searxng/settings.yml

exec /usr/local/searxng/entrypoint.sh
