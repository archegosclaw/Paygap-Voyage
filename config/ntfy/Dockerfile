# Railway's image-source services can't apply a custom start command to a
# pulled image (no build layer to inject CMD into), so we wrap the upstream
# ntfy image with a Dockerfile build instead, baking the "serve" command in.
FROM docker.io/binwiederhier/ntfy

CMD ["serve"]
