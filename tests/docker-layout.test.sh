#!/usr/bin/env bash

set -euo pipefail

ruby -e "require 'yaml'; YAML.load_file('docker-compose.yml')"

for file in Dockerfile .dockerignore nginx.conf docker-compose.yml; do
	[[ -f "$file" ]] || {
		echo "missing required Docker file: $file" >&2
		exit 1
	}
done

grep -q '^FROM node:24-alpine AS builder$' Dockerfile
if grep -q '^# syntax=' Dockerfile; then
	echo 'Dockerfile must not require a remote syntax frontend' >&2
	exit 1
fi
grep -q '^FROM nginx:.*-alpine AS runtime$' Dockerfile
grep -q '^ARG HTTP_PROXY$' Dockerfile
grep -q '^ARG HTTPS_PROXY$' Dockerfile
grep -q '^ARG NO_PROXY$' Dockerfile
grep -q '^ENV NODE_USE_ENV_PROXY=1$' Dockerfile
grep -q '^ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com$' Dockerfile
grep -q '^ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com$' Dockerfile
grep -q '^ARG DISABLE_REMOTE_FONTS=1$' Dockerfile
grep -q '^ARG DISABLE_OG_IMAGES=1$' Dockerfile
grep -q '^ENV DISABLE_REMOTE_FONTS=\${DISABLE_REMOTE_FONTS}$' Dockerfile
grep -q '^ENV DISABLE_OG_IMAGES=\${DISABLE_OG_IMAGES}$' Dockerfile
grep -q '^ENV VIPS_CONCURRENCY=1$' Dockerfile
grep -q '^ENV UV_THREADPOOL_SIZE=1$' Dockerfile
grep -q '^RUN pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com$' Dockerfile
grep -q '^COPY --from=builder /app/dist /usr/share/nginx/html$' Dockerfile
grep -q 'dockerfile: Dockerfile' docker-compose.yml
grep -q 'FIREFLY_PORT:-36055' docker-compose.yml
grep -q 'Cache-Control "public, max-age=31536000, immutable"' nginx.conf
