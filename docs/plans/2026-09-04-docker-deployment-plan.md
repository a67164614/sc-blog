# Docker Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Package Firefly as a reproducible Docker image served by Nginx and document server updates from GitHub.

**Architecture:** A multi-stage Docker build uses Node 24 plus Corepack/pnpm to create `dist/`, then copies that directory into an Nginx Alpine image. Docker Compose runs the Nginx image and passes proxy build arguments from the host environment.

**Tech Stack:** Docker BuildKit, Node.js 24, pnpm 11.22.0, Astro 7, Nginx Alpine, Docker Compose.

---

### Task 1: Define Docker artifact expectations

**Files:**
- Create: `tests/docker-layout.test.sh`

**Step 1: Write the failing test**

Create a shell test that requires `Dockerfile`, `.dockerignore`, `nginx.conf`,
and `docker-compose.yml`, and asserts that the Dockerfile has separate builder
and Nginx stages plus proxy build arguments.

**Step 2: Run test to verify it fails**

Run: `bash tests/docker-layout.test.sh`

Expected: FAIL because Docker deployment files do not exist.

### Task 2: Add Docker build and runtime configuration

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `nginx.conf`
- Create: `docker-compose.yml`

**Step 1: Write minimal implementation**

Create a Node 24 builder with Corepack and a frozen pnpm install. Accept
`HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` as build arguments. Use Nginx
Alpine to serve `/usr/share/nginx/html`, cache `/_astro/`, and provide static
404 handling.

**Step 2: Run the layout test**

Run: `bash tests/docker-layout.test.sh`

Expected: PASS.

**Step 3: Build the image**

Run: `docker build -t firefly-blog:test .`

Expected: exit code 0 and an image containing the generated site.

### Task 3: Document deployment and updates

**Files:**
- Modify: `README.md`

**Step 1: Add deployment instructions**

Document proxy-enabled image builds, `docker compose up -d --build`, first
server checkout, and later `git pull && docker compose up -d --build` updates.

**Step 2: Validate commands and Markdown references**

Run: `rg -n "Docker|docker compose|HTTP_PROXY|git pull" README.md`

Expected: all required deployment instructions are present.

### Task 4: Verify a running container

**Files:**
- Verify: `Dockerfile`
- Verify: `docker-compose.yml`

**Step 1: Start the service**

Run: `FIREFFLY_PORT=8080 docker compose up --build -d`

Expected: Compose reports a running `firefly` service.

**Step 2: Request the page and cache header**

Run: `curl -fsSI http://localhost:8080/` and `curl -fsSI http://localhost:8080/_astro/`

Expected: HTTP 200 for the home page; static assets include immutable caching.

**Step 3: Stop the verification service**

Run: `FIREFFLY_PORT=8080 docker compose down`

Expected: service and temporary network are removed.

### Task 5: Commit and push

**Files:**
- Verify: repository root

**Step 1: Initialize the target repository**

Run: `git init -b main && git remote add origin https://github.com/a67164614/sc-blog.git`

Expected: local `main` branch points to the requested GitHub repository.

**Step 2: Commit files**

Run: `git add . && git commit -m "feat: add Docker deployment"`

Expected: one commit containing Firefly and deployment files.

**Step 3: Push**

Run: `git push -u origin main`

Expected: GitHub accepts the new `main` branch.
