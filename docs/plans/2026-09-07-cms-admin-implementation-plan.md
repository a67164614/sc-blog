# Firefly CMS Admin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a single-administrator `/admin` CMS, third-party JSON article ingestion, and Git-backed Markdown publication while retaining Firefly's static Astro public site.

**Architecture:** Directus and PostgreSQL hold CMS data. A constrained publisher service validates integrations, writes Markdown and configuration snapshots to Git, and deploys through GitHub Actions. Astro reads the generated snapshot at build time; Nginx serves static files and proxies only approved CMS routes.

**Tech Stack:** Astro 7, TypeScript, pnpm, Docker Compose, Nginx, Directus, PostgreSQL 17, Fastify, Zod, `@directus/sdk`, `gray-matter`, GitHub Actions, Node test runner.

---

## Delivery Rules

- Keep `main` deployable after each task; use an isolated feature branch.
- CMS database is authoritative for CMS-managed records. Git Markdown/config snapshots remain the durable knowledge-base and rollback artifact.
- No service gets host Docker socket access. GitHub Actions deploys to the server over SSH.
- Do not commit passwords, tokens, SSH keys, webhook secrets, or generated media credentials.
- Third-party article requests use `Authorization: Bearer <token>`. GitHub webhooks use `X-Hub-Signature-256`.
- Crawler mitigation is deferred.

### Task 1: Change Default Blog Identity

**Files:**
- Modify: `src/config/siteConfig.ts`
- Create: `tests/site-identity.test.sh`

**Step 1: Write a failing test**

```bash
#!/usr/bin/env bash
set -euo pipefail
grep -q 'title: "Sc 的个人博客"' src/config/siteConfig.ts
! grep -q 'title: "Firefly"' src/config/siteConfig.ts
! grep -q 'subtitle: "Demo site"' src/config/siteConfig.ts
```

**Step 2: Verify it fails**

Run: `bash tests/site-identity.test.sh`

Expected: non-zero exit because the existing title and subtitle are Firefly defaults.

**Step 3: Implement minimum change**

Set `title: "Sc 的个人博客"` and `subtitle: ""` in `src/config/siteConfig.ts`. Change demo-specific description/keywords only where they are public default identity. Do not remove Firefly theme attribution here.

**Step 4: Verify and commit**

Run:

```bash
bash tests/site-identity.test.sh
pnpm check
DISABLE_REMOTE_FONTS=1 DISABLE_OG_IMAGES=1 pnpm build
```

Commit: `git commit -am "feat: set personal blog defaults"`

### Task 2: Add CMS Services and `/admin` Proxy

**Files:**
- Modify: `docker-compose.yml`
- Modify: `nginx.conf`
- Create: `.env.example`
- Create: `tests/cms-compose.test.sh`
- Modify: `tests/docker-layout.test.sh`

**Step 1: Write failing Compose tests**

Parse Compose YAML and require `firefly`, `cms-db`, `directus`, and `publisher` services; named `cms-db-data` and `cms-uploads` volumes; health checks; no host port on Directus/PostgreSQL/publisher; and Nginx as the only public entry point. Assert `/admin/` proxies to `directus:8055` and static `location /` fallback remains present.

**Step 2: Verify it fails**

Run: `bash tests/cms-compose.test.sh`

Expected: missing-services failure.

**Step 3: Implement Compose topology**

Add:

```yaml
cms-db:
  image: postgres:17-alpine
  environment:
    POSTGRES_DB: ${CMS_DB_NAME:-firefly_cms}
    POSTGRES_USER: ${CMS_DB_USER:-firefly}
    POSTGRES_PASSWORD: ${CMS_DB_PASSWORD:?set CMS_DB_PASSWORD}
  volumes: [cms-db-data:/var/lib/postgresql/data]

directus:
  image: directus/directus:11
  depends_on: [cms-db]
  environment:
    DB_CLIENT: pg
    DB_HOST: cms-db
    DB_DATABASE: ${CMS_DB_NAME:-firefly_cms}
    DB_USER: ${CMS_DB_USER:-firefly}
    DB_PASSWORD: ${CMS_DB_PASSWORD:?set CMS_DB_PASSWORD}
    ADMIN_EMAIL: ${CMS_ADMIN_EMAIL:?set CMS_ADMIN_EMAIL}
    ADMIN_PASSWORD: ${CMS_ADMIN_PASSWORD:?set CMS_ADMIN_PASSWORD}
```

Pin tested image digests before production. Put only variable names and safe examples in `.env.example`.

**Step 4: Verify `/admin` behavior with disposable data**

Run:

```bash
docker compose --env-file .env.cms-test up -d cms-db directus firefly
curl -fsSI http://127.0.0.1:${FIREFLY_PORT:-36055}/admin/
curl -fsS http://127.0.0.1:${FIREFLY_PORT:-36055}/server/info
docker compose --env-file .env.cms-test down -v
```

Expected: Directus login and required browser API bootstrap work behind `/admin`. If Directus cannot reliably operate from the path prefix, stop and use an `admin` subdomain rather than shipping a broken proxy.

**Step 5: Verify and commit**

Run: `bash tests/docker-layout.test.sh && bash tests/cms-compose.test.sh && docker compose config`

Commit: `git commit -am "feat: add CMS service topology"`

### Task 3: Create Directus Schema and Single-Admin Policy

**Files:**
- Create: `cms/schema.yaml`
- Create: `cms/seed/site-settings.json`
- Create: `cms/README.md`
- Create: `tests/cms-schema.test.mjs`

**Step 1: Write failing schema tests**

Use `node:test` to require collections: `cms_posts`, `cms_tags`, `cms_categories`, `cms_site_settings`, `cms_media`, `cms_integrations`, `cms_sync_events`, and `cms_deployments`. Require a unique source/external-ID mapping and no public role permissions.

**Step 2: Verify failure**

Run: `node --test tests/cms-schema.test.mjs`

**Step 3: Implement snapshot and seed**

Generate a Directus schema snapshot from a disposable database. `cms_posts` needs Markdown body, title, slug, summary, status (`draft`, `pending_review`, `published`, `archived`), taxonomy, cover, source, external ID, source URL, sync hash, and export SHA. `cms_site_settings` is a singleton with grouped JSON fields for identity, appearance, navigation, layout, background, music, comments, and features. `cms_integrations` has source slug, enabled flag, token hash, publication policy, and rotation timestamp. Sync/deploy collections are append-only audits.

Seed identity:

```json
{"identity":{"title":"Sc 的个人博客","subtitle":""}}
```

Create only the bootstrap Administrator role. Disable registration.

**Step 4: Verify and commit**

Run:

```bash
docker compose --env-file .env.cms-test up -d cms-db directus
node --test tests/cms-schema.test.mjs
docker compose --env-file .env.cms-test down -v
```

Commit: `git commit -am "feat: define CMS schema and single-admin policy"`

### Task 4: Scaffold Publisher Service

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `services/publisher/package.json`
- Create: `services/publisher/tsconfig.json`
- Create: `services/publisher/Dockerfile`
- Create: `services/publisher/src/server.ts`
- Create: `services/publisher/src/config.ts`
- Create: `services/publisher/test/health.test.ts`
- Modify: `docker-compose.yml`

**Step 1: Write failing health test**

Test `GET /healthz` returns `{ "status": "ok" }` using Fastify injection.

**Step 2: Verify failure**

Run: `pnpm --filter @sc-blog/publisher test`

Expected: package absent.

**Step 3: Implement minimum service**

Create a Fastify workspace using Zod, `@directus/sdk`, `gray-matter`, and `tsx`. Fail startup unless this configuration validates:

```ts
z.object({
  DIRECTUS_URL: z.string().url(),
  DIRECTUS_SERVICE_TOKEN: z.string().min(1),
  PUBLISHER_INTERNAL_TOKEN: z.string().min(32),
  CONTENT_REPOSITORY: z.string().url(),
  GIT_AUTHOR_NAME: z.string().min(1),
  GIT_AUTHOR_EMAIL: z.string().email(),
});
```

Do not publish its port. Nginx later exposes only the third-party route.

**Step 4: Verify and commit**

Run: `pnpm --filter @sc-blog/publisher test && pnpm --filter @sc-blog/publisher type-check && docker compose build publisher`

Commit: `git commit -am "feat: scaffold CMS publisher service"`

### Task 5: Implement Token-Protected Third-Party Ingestion

**Files:**
- Create: `services/publisher/src/integrations/article-payload.ts`
- Create: `services/publisher/src/integrations/token-auth.ts`
- Create: `services/publisher/src/integrations/article-route.ts`
- Create: `services/publisher/test/article-route.test.ts`
- Modify: `services/publisher/src/server.ts`
- Modify: `nginx.conf`

**Step 1: Write failing endpoint tests**

Cover missing/malformed/disabled tokens (`401`), invalid body (`422`), first valid request (`202`), duplicate source/external ID update without duplicate row, `immediate` status `published`, and `review` status `pending_review`.

**Step 2: Verify failure**

Run: `pnpm --filter @sc-blog/publisher test -- article-route.test.ts`

**Step 3: Implement payload boundary and route**

Expose only:

```text
POST /api/integrations/:source/articles
Authorization: Bearer <integration-token>
Content-Type: application/json
```

Validate `externalId`, `title`, `contentMarkdown`, optional summary/tags/category/cover URL/source URL/published date with Zod. Hash tokens with Argon2 or bcrypt, show only a prefix after creation, and never log raw token or body. Store a redacted synchronization event. Queue publication; never run Git or deployment inside the request handler.

**Step 4: Verify and commit**

Run: `pnpm --filter @sc-blog/publisher test && pnpm --filter @sc-blog/publisher type-check`

Commit: `git commit -am "feat: ingest third-party Markdown articles"`

### Task 6: Export Content and Settings to Markdown/Git Snapshots

**Files:**
- Create: `services/publisher/src/export/markdown.ts`
- Create: `services/publisher/src/export/settings.ts`
- Create: `services/publisher/src/export/media.ts`
- Create: `services/publisher/src/export/git-worktree.ts`
- Create: `services/publisher/test/markdown.test.ts`
- Create: `services/publisher/test/settings.test.ts`
- Create: `src/generated/cms-settings.ts`
- Create: `src/config/cms-overrides.ts`
- Modify: `src/config/siteConfig.ts`
- Modify: `src/config/backgroundWallpaper.ts`
- Modify: `src/config/musicConfig.ts`
- Modify: `src/config/navBarConfig.ts`
- Modify: `src/config/profileConfig.ts`
- Modify: `src/config/sidebarConfig.ts`
- Modify: `src/config/footerConfig.ts`
- Modify: `src/config/announcementConfig.ts`
- Modify: `src/config/commentConfig.ts`
- Modify: `src/config/effectsConfig.ts`
- Modify: `src/config/displaySettingsConfig.ts`

**Step 1: Write failing export tests**

Assert stable frontmatter/body export, no public export of draft/pending records, deterministic re-export without diff, safe typed settings snapshot, secret exclusion, and fallback to existing TypeScript defaults without a snapshot.

**Step 2: Verify failure**

Run: `pnpm --filter @sc-blog/publisher test -- markdown.test.ts settings.test.ts`

**Step 3: Implement serializers**

Export third-party content to:

```text
src/content/posts/imports/<source>/<slug>.md
public/uploads/<source>/<asset>
```

Include `source`, `externalId`, and `syncedAt` in frontmatter. Collision suffixes use a stable short hash of external ID. Enforce remote-cover host allowlist, content type/size limits, timeouts, and decode limits.

Generate `src/generated/cms-settings.ts`. `cms-overrides.ts` validates and merges only whitelisted display settings. Preserve existing TypeScript defaults and keep executable plugin settings out of CMS data.

**Step 4: Verify and commit**

Run:

```bash
pnpm --filter @sc-blog/publisher test
pnpm check
DISABLE_REMOTE_FONTS=1 DISABLE_OG_IMAGES=1 pnpm build
```

Commit: `git commit -am "feat: export CMS content and settings snapshots"`

### Task 7: Add Publish Queue and Deployment Workflow

**Files:**
- Create: `services/publisher/src/publish/queue.ts`
- Create: `services/publisher/src/publish/publish-post.ts`
- Create: `services/publisher/src/routes/deployment-callback.ts`
- Create: `services/publisher/test/publish.test.ts`
- Create: `.github/workflows/deploy.yml`
- Modify: `.env.example`

**Step 1: Write failing tests**

Assert export precedes a `[cms-export]` Git commit, deployment status moves through `queued`, `exporting`, `pushed`, `building`, `succeeded`/`failed`, Git failure does not replace live static files, and callback requires the internal Bearer Token plus matching commit SHA.

**Step 2: Verify failure**

Run: `pnpm --filter @sc-blog/publisher test -- publish.test.ts`

**Step 3: Implement asynchronous publishing**

Use PostgreSQL-backed jobs. GitHub Action triggers on `main` changes to content, generated settings, source, and Compose files, then runs remotely:

```bash
cd /opt/firefly
git pull --ff-only origin main
docker compose up -d --build
```

The action calls back with a redacted result. Store `SERVER_HOST`, `SERVER_USER`, `SERVER_PORT`, `SERVER_SSH_KEY`, callback URL, and callback token only as GitHub Actions secrets.

**Step 4: Verify and commit**

Run: `pnpm --filter @sc-blog/publisher test && git diff --check`

Commit: `git commit -am "feat: publish CMS changes through GitHub deployment"`

### Task 8: Import Existing and Manual Git Markdown

**Files:**
- Create: `services/publisher/src/import/markdown.ts`
- Create: `services/publisher/src/import/github-webhook.ts`
- Create: `services/publisher/test/markdown-import.test.ts`
- Create: `services/publisher/test/github-webhook.test.ts`
- Create: `scripts/import-existing-content.ts`
- Modify: `nginx.conf`
- Modify: `.env.example`

**Step 1: Write failing importer tests**

Cover current `.md` and `.mdx` frontmatter parsing, stable path mapping, manual update upsert, `[cms-export]` loop avoidance, and a Git/CMS concurrent-edit conflict.

**Step 2: Verify failure**

Run: `pnpm --filter @sc-blog/publisher test -- markdown-import.test.ts github-webhook.test.ts`

**Step 3: Implement importer**

Validate the GitHub webhook signature and accept only `push` events from this repository's `main`. Bot exporter commits are ignored. The initial importer is dry-run by default and needs `--apply` to mutate CMS data. A newer CMS revision must create a conflict record rather than overwrite it.

**Step 4: Verify and commit**

Run: `pnpm --filter @sc-blog/publisher test && pnpm tsx scripts/import-existing-content.ts --dry-run`

Commit: `git commit -am "feat: import Git Markdown into CMS"`

### Task 9: Configure Admin Screens and Production Recovery

**Files:**
- Modify: `cms/schema.yaml`
- Create: `cms/presets.json`
- Create: `cms/flows.json`
- Create: `tests/cms-e2e.test.sh`
- Create: `docs/cms-admin.md`
- Create: `docs/cms-deployment.md`
- Create: `docs/cms-backup-and-recovery.md`
- Modify: `README.md`

**Step 1: Write end-to-end acceptance test**

In a disposable stack, verify `/admin/` login and public `/`; immediate/review ingestion modes; Markdown export; idempotency; invalid token rejection; generated title/logo/theme/background/navigation/music settings; and a simulated failed build preserving the previous static output.

**Step 2: Verify failure**

Run: `bash tests/cms-e2e.test.sh`

**Step 3: Configure Directus and documentation**

Add Directus views for article state, Markdown editor, taxonomy, media, grouped singleton site settings, integrations/token rotation, sync events, and deployments. Document first boot, administrator password rotation, migration dry-run/apply, `.env` values, GitHub secrets, database/uploads backup and restore, Git rollback, and token rotation.

**Step 4: Run final verification and commit**

Run:

```bash
bash tests/docker-layout.test.sh
bash tests/cms-compose.test.sh
bash tests/site-identity.test.sh
pnpm --filter @sc-blog/publisher test
pnpm check
DISABLE_REMOTE_FONTS=1 DISABLE_OG_IMAGES=1 pnpm build
bash tests/cms-e2e.test.sh
docker compose config
git diff --check
```

Commit: `git commit -am "docs: add CMS deployment and recovery guide"`
