import assert from "node:assert/strict";
import test from "node:test";
import { exportPostMarkdown, postOutputPath } from "../src/export/markdown.js";

const post = {
  title: "同步文章",
  externalId: "remote-42",
  source: "notes",
  contentMarkdown: "# 正文\n\n内容。\n",
  description: "摘要",
  tags: ["知识库", "同步"],
  category: "笔记",
  sourceUrl: "https://source.example/articles/42",
  publishedAt: "2026-09-07T10:00:00+08:00",
  status: "published" as const,
};

test("exports a published post with stable Firefly frontmatter", () => {
  const output = exportPostMarkdown(post, "2026-09-07T10:01:00.000Z");
  assert.ok(output);
  assert.match(output, /^---\ntitle: /);
  assert.match(output, /source: "notes"/);
  assert.match(output, /externalId: "remote-42"/);
  assert.match(output, /syncedAt: "2026-09-07T10:01:00.000Z"/);
  assert.match(output, /# 正文/);
  assert.equal(output, exportPostMarkdown(post, "2026-09-07T10:01:00.000Z"));
});

test("does not export drafts or pending-review posts", () => {
  assert.equal(exportPostMarkdown({ ...post, status: "draft" }, new Date().toISOString()), null);
  assert.equal(exportPostMarkdown({ ...post, status: "pending_review" }, new Date().toISOString()), null);
});

test("maps source and external ID to a stable collision-safe path", () => {
  assert.equal(postOutputPath(post), "src/content/posts/imports/notes/同步文章--6b516fdf.md");
});
