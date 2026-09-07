import type { ArticlePayload } from "./article-payload.js";
import { type PublisherConfig } from "../config.js";

export type PublicationPolicy = "immediate" | "review";

export type Integration = {
  source: string;
  enabled: boolean;
  tokenHash: string;
  publicationPolicy: PublicationPolicy;
};

export type StoredArticle = ArticlePayload & {
  id: string;
  source: string;
  sourceExternalKey: string;
  status: "published" | "pending_review";
};

export interface ArticleStore {
  getIntegration(source: string): Promise<Integration | null>;
  upsertArticle(article: StoredArticle): Promise<{ article: StoredArticle; created: boolean }>;
  recordSyncEvent(event: { source: string; externalId: string; outcome: string; errorMessage?: string }): Promise<void>;
}

export class InMemoryArticleStore implements ArticleStore {
  readonly integrations = new Map<string, Integration>();
  readonly articles: StoredArticle[] = [];
  readonly syncEvents: Array<{ source: string; externalId: string; outcome: string; errorMessage?: string }> = [];

  async addIntegration(integration: Integration): Promise<void> {
    this.integrations.set(integration.source, integration);
  }

  async getIntegration(source: string): Promise<Integration | null> {
    return this.integrations.get(source) ?? null;
  }

  async upsertArticle(article: StoredArticle): Promise<{ article: StoredArticle; created: boolean }> {
    const index = this.articles.findIndex((candidate) => candidate.sourceExternalKey === article.sourceExternalKey);
    if (index < 0) {
      this.articles.push(article);
      return { article, created: true };
    }
    this.articles[index] = { ...this.articles[index], ...article, id: this.articles[index].id };
    return { article: this.articles[index], created: false };
  }

  async recordSyncEvent(event: { source: string; externalId: string; outcome: string; errorMessage?: string }): Promise<void> {
    this.syncEvents.push(event);
  }
}

type DirectusResponse<T> = { data: T };

export class DirectusArticleStore implements ArticleStore {
  constructor(private readonly config: PublisherConfig) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.DIRECTUS_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.DIRECTUS_SERVICE_TOKEN}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Directus request failed with status ${response.status}`);
    const payload = (await response.json()) as DirectusResponse<T>;
    return payload.data;
  }

  async getIntegration(source: string): Promise<Integration | null> {
    const params = new URLSearchParams({ "filter[source][_eq]": source, limit: "1" });
    const rows = await this.request<Array<{ source: string; enabled: boolean; token_hash: string; publication_policy: PublicationPolicy }>>(`/items/cms_integrations?${params}`);
    const row = rows[0];
    return row ? { source: row.source, enabled: row.enabled, tokenHash: row.token_hash, publicationPolicy: row.publication_policy } : null;
  }

  async upsertArticle(article: StoredArticle): Promise<{ article: StoredArticle; created: boolean }> {
    const params = new URLSearchParams({ "filter[source_external_key][_eq]": article.sourceExternalKey, limit: "1" });
    const existing = await this.request<StoredArticle[]>(`/items/cms_posts?${params}`);
    const body = {
      title: article.title,
      slug: article.externalId.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "imported-article",
      content_markdown: article.contentMarkdown,
      summary: article.description,
      status: article.status,
      tags: article.tags,
      category: article.category,
      cover_url: article.coverUrl,
      source: article.source,
      external_id: article.externalId,
      source_external_key: article.sourceExternalKey,
      source_url: article.sourceUrl,
      published_at: article.publishedAt,
    };
    const saved = existing[0]
      ? await this.request<StoredArticle>(`/items/cms_posts/${existing[0].id}`, { method: "PATCH", body: JSON.stringify(body) })
      : await this.request<StoredArticle>("/items/cms_posts", { method: "POST", body: JSON.stringify(body) });
    return { article: saved, created: !existing[0] };
  }

  async recordSyncEvent(event: { source: string; externalId: string; outcome: string; errorMessage?: string }): Promise<void> {
    await this.request("/items/cms_sync_events", { method: "POST", body: JSON.stringify({
      source: event.source,
      external_id: event.externalId,
      event_type: "article_push",
      outcome: event.outcome,
      error_message: event.errorMessage,
      created_at: new Date().toISOString(),
    }) });
  }
}
