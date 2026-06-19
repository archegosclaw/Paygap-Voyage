# Standalone SearXNG image for platforms that don't run docker-compose
# (e.g. Railway). docker-compose.yml renders settings.yml via a shell
# entrypoint that substitutes __SEARXNG_SECRET__ from $SEARXNG_SECRET on
# first boot; this image does the same substitution but on every boot,
# since Railway containers don't keep the docker-compose named volume
# (etc/searxng) between deploys.
FROM docker.io/searxng/searxng:2026.5.31-7159b8aed

COPY config/searxng/settings.yml /etc/searxng/settings.yml.template
COPY config/searxng/railway-entrypoint.sh /usr/local/bin/railway-entrypoint.sh

USER root
RUN chmod +x /usr/local/bin/railway-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/railway-entrypoint.sh"]
