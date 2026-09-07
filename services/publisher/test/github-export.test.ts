import assert from "node:assert/strict";
import test from "node:test";
import { exportPostToGitHub, type GitHubFileClient } from "../src/export/github.js";

test("exports published Markdown to GitHub with a CMS marker", async () => {
  const calls: Array<{ path: string; content: string; message: string }> = [];
  const client: GitHubFileClient = {
    async putFile(input) {
      calls.push(input);
      return "commit-sha";
    },
  };
  const sha = await exportPostToGitHub(client, {
    source: "notes",
    externalId: "42",
    title: "同步文章",
    contentMarkdown: "正文",
    description: "摘要",
    tags: [],
    status: "published",
  }, "2026-09-07T10:00:00.000Z");
  assert.equal(sha, "commit-sha");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "src/content/posts/imports/notes/同步文章--73475cb4.md");
  assert.match(calls[0].message, /^\[cms-export\]/);
  assert.match(calls[0].content, /externalId: "42"/);
});

test("does not export non-published Markdown", async () => {
  let called = false;
  const client: GitHubFileClient = { async putFile() { called = true; return "unused"; } };
  const result = await exportPostToGitHub(client, { source: "notes", externalId: "draft", title: "Draft", contentMarkdown: "body", tags: [], status: "draft" }, new Date().toISOString());
  assert.equal(result, null);
  assert.equal(called, false);
});
