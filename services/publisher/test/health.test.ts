import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/server.js";

test("GET /healthz reports a healthy publisher", async (t) => {
  const app = createServer({
    DIRECTUS_URL: "http://directus:8055",
    DIRECTUS_SERVICE_TOKEN: "test-service-token",
    PUBLISHER_INTERNAL_TOKEN: "x".repeat(32),
    CONTENT_REPOSITORY: "https://github.com/a67164614/sc-blog.git",
    GIT_AUTHOR_NAME: "Sc Blog CMS",
    GIT_AUTHOR_EMAIL: "cms@example.com",
    GITHUB_TOKEN: "test-github-token",
    GITHUB_BRANCH: "main",
    GITHUB_API_URL: "https://api.github.com",
    PUBLISHER_PORT: 8787,
  });
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/healthz" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
});
