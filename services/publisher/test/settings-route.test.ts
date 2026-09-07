import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/server.js";
import type { GitHubFileClient } from "../src/export/github.js";
import { InMemoryArticleStore } from "../src/integrations/store.js";
import { NoopPublicationQueue } from "../src/publish/queue.js";

const config = {
  DIRECTUS_URL: "http://directus:8055",
  DIRECTUS_SERVICE_TOKEN: "test-service-token",
  PUBLISHER_INTERNAL_TOKEN: "i".repeat(32),
  CONTENT_REPOSITORY: "https://github.com/a67164614/sc-blog.git",
  GIT_AUTHOR_NAME: "Sc Blog CMS",
  GIT_AUTHOR_EMAIL: "cms@example.com",
  GITHUB_TOKEN: "test-github-token",
  GITHUB_BRANCH: "main",
  GITHUB_API_URL: "https://api.github.com",
  PUBLISHER_PORT: 8787,
};

test("commits sanitized settings through the internal endpoint", async (t) => {
  const calls: Array<{ path: string; content: string; message: string }> = [];
  const client: GitHubFileClient = { async putFile(input) { calls.push(input); return "settings-sha"; } };
  const app = createServer(config, new InMemoryArticleStore(), new NoopPublicationQueue(), client);
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/cms/settings",
    headers: { authorization: `Bearer ${config.PUBLISHER_INTERNAL_TOKEN}` },
    payload: { identity: { title: "新标题" }, integrations: { token: "drop-me" } },
  });
  assert.equal(response.statusCode, 202);
  assert.equal(response.json().commitSha, "settings-sha");
  assert.equal(calls[0].path, "src/generated/cms-settings.ts");
  assert.doesNotMatch(calls[0].content, /drop-me/);
});

test("requires the internal token for settings export", async (t) => {
  const client: GitHubFileClient = { async putFile() { throw new Error("must not call"); } };
  const app = createServer(config, new InMemoryArticleStore(), new NoopPublicationQueue(), client);
  t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/cms/settings", payload: { identity: {} } });
  assert.equal(response.statusCode, 401);
});
