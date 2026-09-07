# Firefly CMS Admin Design

## Goal

Add a single-administrator CMS at `/admin` while keeping Firefly as a static Astro site. The administrator can manage articles, media, and all user-facing site settings. Published content remains available as Markdown in Git so the repository can serve as a long-term knowledge base.

## Decisions

- The public blog remains an Astro static build behind Nginx.
- Directus provides the initial `/admin` interface and its API.
- PostgreSQL stores CMS state, drafts, media metadata, site settings, integration settings, and sync history.
- The CMS database is authoritative for CMS-managed records. A publisher serializes published records to Markdown and configuration snapshots, commits them to GitHub, then triggers the static deployment.
- Existing Markdown content is imported during migration. Manual Git changes remain supported through a GitHub webhook importer; bot-authored export commits are marked to avoid import loops.
- The initial site identity is `Sc 的个人博客`. `Firefly` and `Demo site` must not remain as the default public name or subtitle.
- Crawler protection is explicitly deferred to a later phase.

## Deployment Topology

```text
Browser -> Nginx -> /          -> Firefly static files
                 -> /admin/   -> Directus admin UI
                 -> /api/     -> restricted CMS and integration APIs

Directus + publisher service -> PostgreSQL
publisher service            -> GitHub repository -> deployment trigger -> Astro Docker build
```

The publisher is a narrowly scoped service. Directus must not receive unrestricted access to the host Docker socket. Publishing records a build request and status; a deployment worker performs the Git update and static-site build.

## Administrator Scope

The initial installation has exactly one administrator account. Public registration is disabled.

The administrator can manage:

- Posts: title, Markdown body, slug, summary, draft/published state, publish date, category, tags, cover image, source URL, pinned status, password settings, and series metadata.
- Media: uploads, image metadata, covers, music assets, and attachments.
- Site identity: blog title, subtitle, description, favicon, light/dark logos, SEO metadata, and social links.
- Appearance: theme color, color mode, card/tag/category styles, layout width, background wallpaper, fonts, effects, and feature switches.
- Layout and content modules: navigation, sidebar, footer, announcement, profile, friends, gallery, sponsor settings, comments, and music player settings.
- Integrations: source name, active flag, token rotation, publication mode, and synchronization history.
- Publishing: build queue, current status, build output summary, error details, and rollback target.

Code-defined plugins and arbitrary executable scripts are not editable from `/admin`. Secrets are stored as protected server configuration or encrypted CMS values and are never emitted to public static files or Markdown.

## Article and Knowledge-Base Model

Published articles are stored in PostgreSQL and exported to versioned Markdown files in Git. Imported third-party content uses a stable source directory:

```text
src/content/posts/imports/<source>/<slug>.md
public/uploads/<source>/<asset>
```

Each exported article contains standard Firefly frontmatter plus origin metadata:

```yaml
---
title: Example synchronized article
published: 2026-09-07
tags: [knowledge-base]
category: Notes
source: source-name
externalId: article-12345
syncedAt: 2026-09-07T10:30:00+08:00
---
```

The source ID and external ID form a unique key. A repeated third-party request updates the existing record rather than creating a duplicate. Markdown is retained even when the CMS supplies the public page, preserving Git history, offline search, backups, and future migration options.

## Third-Party Push API

Each integration owns a revocable Bearer Token. The interface accepts JSON only:

```text
POST /api/integrations/{source}/articles
Authorization: Bearer <integration-token>
Content-Type: application/json
```

The preferred request body includes `externalId`, `title`, `contentMarkdown`, `description`, `tags`, `category`, `coverUrl`, `sourceUrl`, and `publishedAt`. `contentHtml` may be accepted as a compatibility input and converted to sanitized Markdown.

Every integration has one publication policy:

- `immediate`: validate, upsert, publish, export Markdown, and request a static deployment.
- `review`: validate, upsert as pending review, and wait for administrator publication.

Responses must be idempotent for a source/external-ID pair, avoid exposing token values, and retain request outcome, source revision, and validation failures in the synchronization log.

## Publication Flow

```text
Admin publish or accepted integration push
  -> validate and persist transactionally
  -> serialize content and settings snapshot
  -> commit a traceable Git revision
  -> request deployment
  -> build Astro static site in Docker
  -> record success or failure in the CMS
```

Manual Markdown commits follow the inverse ingestion path: the GitHub webhook importer identifies user-authored commits, parses files, upserts CMS records, and requests a build. Exporter commits include a machine marker so they do not loop back into the importer. Conflicts are surfaced in the CMS rather than silently overwriting either side.

## Deferred Scope

- Crawl mitigation, bot filtering, and rate limiting.
- Multiple administrator or editor roles.
- Arbitrary custom code editing from the admin interface.
- Real-time server-rendered public pages. Content changes take effect after the deployment build completes.

## Acceptance Criteria

- A single administrator signs in at `/admin` and public registration is unavailable.
- The administrator changes the title, logo/favicon, theme, background, navigation, and music settings without editing TypeScript manually.
- The public defaults are `Sc 的个人博客`; no default `Firefly - Demo site` identity remains.
- A CMS-published article renders on the static public blog and has a committed Markdown counterpart in Git.
- A manually committed Markdown article can be imported into the CMS without duplicate records.
- A valid third-party JSON request with a Bearer Token upserts one article; an invalid or revoked token is rejected.
- Both `immediate` and `review` integration publication policies work.
- A failed build leaves the last successful static site available and records the error for the administrator.
