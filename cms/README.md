# CMS schema

`schema.yaml` is the versioned CMS schema manifest. It uses JSON syntax, which is
valid YAML 1.2, so Node bootstrap tooling can parse it without another dependency.

The manifest describes the eight CMS collections and their allowed administrator
operations. The public role has no permissions. Directus' built-in Administrator
account is the only account created during first boot; public registration remains
disabled in the Compose configuration.

`seed/site-settings.json` is the initial singleton settings record. Secrets such as
integration tokens are deliberately absent and must never be exported to Astro.
