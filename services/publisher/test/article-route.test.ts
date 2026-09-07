import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/server.js";
import { InMemoryArticleStore } from "../src/integrations/store.js";
import { hashToken } from "../src/integrations/token-auth.js";

const config = {
  DIRECTUS_URL: "http://directus:8055",
  DIRECTUS_SERVICE_TOKEN: "test-service-token",
  PUBLISHER_INTERNAL_TOKEN: "x".repeat(32),
  CONTENT_REPOSITORY: "https://github.com/a67164614/sc-blog.git",
  GIT_AUTHOR_NAME: "Sc Blog CMS",
  GIT_AUTHOR_EMAIL: "cms@example.com",
  PUBLISHER_PORT: 8787,
};

async function createApp(policy: "immediate" | "review" = "immediate") {
  const store = new InMemoryArticleStore();
  await store.addIntegration({ source: "notes", enabled: true, tokenHash: await hashToken("secret-token"), publicationPolicy: policy });
  const app = createServer(config, store);
  return { app, store };
}

test("rejects a missing integration token", async (t) => {
  const { app } = await createApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/integrations/notes/articles", payload: {} });
  assert.equal(response.statusCode, 401);
});

test("publishes an immediate article and upserts duplicate external IDs", async (t) => {
  const { app, store } = await createApp();
  t.after(() => app.close());
  const payload = { externalId: "n-1", title: "First note", contentMarkdown: "# Hello", tags: ["notes"] };
  const first = await app.inject({ method: "POST", url: "/api/integrations/notes/articles", headers: { authorization: "Bearer secret-token" }, payload });
  const second = await app.inject({ method: "POST", url: "/api/integrations/notes/articles", headers: { authorization: "Bearer secret-token" }, payload: { ...payload, title: "Updated note" } });
  assert.equal(first.statusCode, 202);
  assert.equal(first.json().status, "published");
  assert.equal(second.statusCode, 202);
  assert.equal(store.articles.length, 1);
  assert.equal(store.articles[0].title, "Updated note");
});

test("stores review integrations as pending review", async (t) => {
  const { app, store } = await createApp("review");
  t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/integrations/notes/articles", headers: { authorization: "Bearer secret-token" }, payload: { externalId: "n-2", title: "Needs review", contentMarkdown: "body" } });
  assert.equal(response.statusCode, 202);
  assert.equal(response.json().status, "pending_review");
  assert.equal(store.articles[0].status, "pending_review");
});

test("rejects malformed article JSON", async (t) => {
  const { app } = await createApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/integrations/notes/articles", headers: { authorization: "Bearer secret-token" }, payload: { externalId: "", title: "", contentMarkdown: "" } });
  assert.equal(response.statusCode, 422);
});
