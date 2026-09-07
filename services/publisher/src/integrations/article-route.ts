import type { FastifyInstance } from "fastify";
import { articlePayloadSchema } from "./article-payload.js";
import type { ArticleStore } from "./store.js";
import { readBearerToken, verifyToken } from "./token-auth.js";
import type { PublicationQueue } from "../publish/queue.js";

export function registerArticleRoute(app: FastifyInstance, store: ArticleStore, queue: PublicationQueue): void {
  app.post<{ Params: { source: string }; Body: unknown }>("/api/integrations/:source/articles", async (request, reply) => {
    const source = request.params.source;
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(source)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const integration = await store.getIntegration(source);
    const token = readBearerToken(request.headers.authorization);
    if (!integration?.enabled || !token || !(await verifyToken(token, integration.tokenHash))) {
      return reply.code(401).send({ error: "invalid_integration_token" });
    }

    const parsed = articlePayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(422).send({ error: "invalid_article", fields: parsed.error.issues.map((issue) => issue.path.join(".")) });
    }

    const status = integration.publicationPolicy === "immediate" ? "published" : "pending_review";
    const article = {
      ...parsed.data,
      id: crypto.randomUUID(),
      source,
      sourceExternalKey: `${source}:${parsed.data.externalId}`,
      status,
    } as const;

    try {
      const result = await store.upsertArticle(article);
      await store.recordSyncEvent({ source, externalId: parsed.data.externalId, outcome: "accepted" });
      if (status === "published") queue.enqueue(article, new Date().toISOString());
      return reply.code(202).send({ id: result.article.id, status: result.article.status, created: result.created });
    } catch (error) {
      await store.recordSyncEvent({ source, externalId: parsed.data.externalId, outcome: "failed", errorMessage: error instanceof Error ? error.message : "unknown error" }).catch(() => undefined);
      return reply.code(503).send({ error: "publisher_unavailable" });
    }
  });
}
