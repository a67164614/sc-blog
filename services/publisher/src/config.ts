import { z } from "zod";

const publisherConfigSchema = z.object({
  DIRECTUS_URL: z.url(),
  DIRECTUS_SERVICE_TOKEN: z.string().min(1),
  PUBLISHER_INTERNAL_TOKEN: z.string().min(32),
  CONTENT_REPOSITORY: z.url(),
  GIT_AUTHOR_NAME: z.string().min(1),
  GIT_AUTHOR_EMAIL: z.email(),
  GITHUB_TOKEN: z.string().min(1),
  GITHUB_BRANCH: z.string().min(1).default("main"),
  GITHUB_API_URL: z.url().default("https://api.github.com"),
  PUBLISHER_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
});

export type PublisherConfig = z.infer<typeof publisherConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PublisherConfig {
  const result = publisherConfigSchema.safeParse({
    DIRECTUS_URL: env.DIRECTUS_URL,
    DIRECTUS_SERVICE_TOKEN: env.DIRECTUS_SERVICE_TOKEN,
    PUBLISHER_INTERNAL_TOKEN: env.PUBLISHER_INTERNAL_TOKEN,
    CONTENT_REPOSITORY: env.CONTENT_REPOSITORY,
    GIT_AUTHOR_NAME: env.GIT_AUTHOR_NAME,
    GIT_AUTHOR_EMAIL: env.GIT_AUTHOR_EMAIL,
    PUBLISHER_PORT: env.PUBLISHER_PORT,
  });

  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid publisher configuration: ${details}`);
  }

  return result.data;
}
