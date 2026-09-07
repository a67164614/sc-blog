import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = JSON.parse(await readFile(new URL("../cms/schema.yaml", import.meta.url), "utf8"));

test("CMS schema declares all managed collections", () => {
  assert.deepEqual(schema.collections.map((collection) => collection.name), [
    "cms_posts", "cms_tags", "cms_categories", "cms_site_settings",
    "cms_media", "cms_integrations", "cms_sync_events", "cms_deployments",
  ]);
});

test("posts have a stable source and external ID key", () => {
  const posts = schema.collections.find((collection) => collection.name === "cms_posts");
  const sourceKey = posts.fields.find((field) => field.name === "source_external_key");
  const status = posts.fields.find((field) => field.name === "status");
  assert.equal(sourceKey.unique, true);
  assert.ok(posts.fields.some((field) => field.name === "content_markdown"));
  assert.deepEqual(status.choices, ["draft", "pending_review", "published", "archived"]);
});

test("site settings are a singleton and public permissions are empty", () => {
  const settings = schema.collections.find((collection) => collection.name === "cms_site_settings");
  assert.equal(settings.singleton, true);
  assert.deepEqual(schema.permissions.public, []);
  assert.deepEqual(schema.permissions.administrator, ["read", "create", "update", "delete"]);
});
