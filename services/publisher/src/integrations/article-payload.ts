import { z } from "zod";

export const articlePayloadSchema = z.object({
  externalId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  contentMarkdown: z.string().min(1).max(2_000_000),
  description: z.string().max(2_000).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  category: z.string().trim().max(100).optional(),
  coverUrl: z.url().max(2_000).optional(),
  sourceUrl: z.url().max(2_000).optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
});

export type ArticlePayload = z.infer<typeof articlePayloadSchema>;
