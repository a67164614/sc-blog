# CMS deployment

The stable public site remains the `main` branch and listens on port `36055`.
The CMS overlay adds PostgreSQL, Directus, a schema bootstrap job, and the private
publisher service. Directus and PostgreSQL have no host ports; Nginx is the only
public entry point.

## First boot

On the server:

```bash
cd /opt/firefly/sc-blog
cp .env.example .env.cms
openssl rand -hex 32
```

Fill `.env.cms` with unique database, Directus, administrator, publisher, and
GitHub values. `GITHUB_TOKEN` needs repository contents write access. Then start:

```bash
docker compose -f docker-compose.yml -f docker-compose.cms.yml --env-file .env.cms up -d --build
docker compose -f docker-compose.yml -f docker-compose.cms.yml --env-file .env.cms ps
```

The bootstrap container creates the CMS collections and default `Sc 的个人博客`
settings. Open `https://blog.ycocc.com/admin/` and sign in with the configured
administrator email and password.

## Automatic deployment

Configure these GitHub Actions secrets: `SERVER_HOST`, `SERVER_PORT`,
`SERVER_USER`, and `SERVER_SSH_KEY`. The deploy key's server account must be able
to run Docker and pull this repository. A push to `main` rebuilds the static
container. CMS publisher commits use the `[cms-export]` marker and are deployed
by the same workflow.

Never place `.env.cms`, Directus keys, integration tokens, or SSH private keys in
Git. Rotate the GitHub token and integration tokens when they are exposed or no
longer needed.
