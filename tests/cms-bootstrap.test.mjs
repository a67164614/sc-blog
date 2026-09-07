import test from "node:test";
import assert from "node:assert/strict";
import { collectionPayload, fieldPayload } from "../cms/bootstrap.mjs";

test("bootstrap maps singleton collections and required fields to Directus payloads", () => {
  const collection = collectionPayload({ name: "cms_site_settings", singleton: true });
  const field = fieldPayload("cms_site_settings", { name: "identity", type: "json", required: true });
  assert.equal(collection.collection, "cms_site_settings");
  assert.equal(collection.meta.singleton, true);
  assert.equal(field.field, "identity");
  assert.equal(field.type, "json");
  assert.equal(field.schema.is_nullable, false);
});

test("bootstrap maps CMS date fields to PostgreSQL timestamps", () => {
  const field = fieldPayload("cms_posts", { name: "published_at", type: "dateTime" });
  assert.equal(field.type, "timestamp");
});
