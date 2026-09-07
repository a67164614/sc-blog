-- Directus 11 stores global administrator access in policies, linked through
-- directus_access. Attach its built-in Administrator policy to the configured
-- account before the API bootstrap creates CMS content records.
WITH admin_user AS (
  SELECT id
  FROM directus_users
  WHERE email = :'admin_email'
    AND status = 'active'
), admin_policy AS (
  SELECT id
  FROM directus_policies
  WHERE admin_access = true
  ORDER BY id
  LIMIT 1
)
INSERT INTO directus_access (id, role, "user", policy, sort)
SELECT
  md5(random()::text || clock_timestamp()::text)::uuid,
  NULL,
  admin_user.id,
  admin_policy.id,
  1
FROM admin_user
CROSS JOIN admin_policy
WHERE NOT EXISTS (
  SELECT 1
  FROM directus_access
  WHERE directus_access."user" = admin_user.id
    AND directus_access.policy = admin_policy.id
);
