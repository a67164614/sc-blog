import Fastify, { type FastifyInstance } from "fastify";
import { pathToFileURL } from "node:url";
import { loadConfig, type PublisherConfig } from "./config.js";
import { registerArticleRoute } from "./integrations/article-route.js";
import { DirectusArticleStore, type ArticleStore } from "./integrations/store.js";
import { GitHubContentsClient } from "./export/github.js";
import { GitHubPublicationQueue, NoopPublicationQueue, type PublicationQueue } from "./publish/queue.js";

export function createServer(config: PublisherConfig, store: ArticleStore = new DirectusArticleStore(config), queue: PublicationQueue = new NoopPublicationQueue()): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));
  registerArticleRoute(app, store, queue);

  return app;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  const config = loadConfig();
  const app = createServer(config, new DirectusArticleStore(config), new GitHubPublicationQueue(new GitHubContentsClient(config)));
  app.listen({ host: "0.0.0.0", port: config.PUBLISHER_PORT }).catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
}
