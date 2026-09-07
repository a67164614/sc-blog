import { createHash } from "node:crypto";
import type { ArticlePayload } from "../integrations/article-payload.js";

export type ExportablePost = ArticlePayload & { source: string; status: "published" | "pending_review" | "draft" };

function segment(value: string, fallback: string): string {
  const safe = value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return safe || fallback;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export function postOutputPath(post: Pick<ExportablePost, "source" | "title" | "externalId">): string {
  return `src/content/posts/imports/${segment(post.source, "unknown")}/${segment(post.title, "imported-article")}--${shortHash(post.externalId)}.md`;
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function exportPostMarkdown(post: ExportablePost, syncedAt: string): string | null {
  if (post.status !== "published") return null;
  const published = post.publishedAt?.slice(0, 10) || syncedAt.slice(0, 10);
  const lines = [
    "---",
    `title: ${yamlString(post.title)}`,
    `published: ${yamlString(published)}`,
    `description: ${yamlString(post.description || "")}`,
    `image: ${yamlString(post.coverUrl || "")}`,
    `tags: ${JSON.stringify(post.tags)}`,
    `category: ${yamlString(post.category || "")}`,
    `sourceLink: ${yamlString(post.sourceUrl || "")}`,
    `source: ${yamlString(post.source)}`,
    `externalId: ${yamlString(post.externalId)}`,
    `syncedAt: ${yamlString(syncedAt)}`,
    "---",
    "",
    post.contentMarkdown.trimEnd(),
    "",
  ];
  return lines.join("\n");
}
