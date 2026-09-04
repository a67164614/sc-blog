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
grep -q '^FROM nginx:.*-alpine AS runtime$' Dockerfile
grep -q '^ARG HTTP_PROXY$' Dockerfile
grep -q '^ARG HTTPS_PROXY$' Dockerfile
grep -q '^ARG NO_PROXY$' Dockerfile
grep -q '^ENV NODE_USE_ENV_PROXY=1$' Dockerfile
grep -q '^COPY --from=builder /app/dist /usr/share/nginx/html$' Dockerfile
grep -q 'dockerfile: Dockerfile' docker-compose.yml
grep -q 'FIREFLY_PORT:-80' docker-compose.yml
grep -q 'Cache-Control "public, max-age=31536000, immutable"' nginx.conf
