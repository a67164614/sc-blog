# Docker Deployment Design

## Context

Firefly is an Astro static site. Its production artifact is `dist/`; it does
not need a Node.js process at runtime. The current build optionally generates
OG images and accesses Google Fonts. The target server has an outbound proxy,
so OG image generation remains enabled.

## Decision

Use a multi-stage Docker image. A Node 24 builder installs the locked pnpm
dependencies and runs `pnpm build`. It accepts `HTTP_PROXY`, `HTTPS_PROXY`,
and `NO_PROXY` build arguments so dependency and font downloads can use the
server proxy. An Nginx Alpine runtime image serves only the generated static
files.

`docker-compose.yml` exposes Nginx on `${FIREFLY_PORT:-80}` and restarts the
container unless it is explicitly stopped. The project keeps all site content
and `generateOgImages` settings unchanged.

## Operations

The server checks out this repository once, then updates with `git pull` and
`docker compose up --build -d`. This is an explicit pull-and-rebuild workflow,
not a push-triggered deployment. The README will document both normal builds
and proxy-enabled builds.

## Verification

Build the image with Docker, start it with Compose, request the root page, and
confirm that static assets receive a long-lived cache policy. The Astro build
remains the primary check that the site can produce `dist/`.
