import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const directusUrl = (process.env.DIRECTUS_URL || "http://directus:8055").replace(/\/$/, "");

async function request(path, options = {}, token) {
  const response = await fetch(`${directusUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Directus ${options.method || "GET"} ${path} failed (${response.status})`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function fieldType(type) {
  return type === "dateTime" ? "timestamp" : type;
}

export function collectionPayload(collection) {
  return {
    collection: collection.name,
    meta: { singleton: collection.singleton, hidden: false, icon: "folder" },
    schema: {},
  };
}

export function fieldPayload(collectionName, field) {
  const schema = {};
  if (field.primary) {
    schema.is_primary_key = true;
    schema.is_unique = true;
    schema.is_nullable = false;
  } else if (field.required) {
    schema.is_nullable = false;
  }
  if (field.default !== undefined) schema.default_value = field.default;
  return {
    field: field.name,
    type: fieldType(field.type),
    meta: {
      interface: field.type === "json" ? "input-code" : "input",
      required: Boolean(field.required),
      hidden: Boolean(field.hidden),
      special: field.primary ? ["primary-key"] : undefined,
      options: field.choices ? { choices: field.choices.map((value) => ({ text: value, value })) } : undefined,
    },
    schema,
  };
}

async function login() {
  const result = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: process.env.CMS_ADMIN_EMAIL, password: process.env.CMS_ADMIN_PASSWORD }),
  });
  return result.data.access_token;
}

async function ensureCollection(collection, token) {
  let exists = false;
  try {
    await request(`/collections/${collection.name}`, {}, token);
    exists = true;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  if (!exists) await request("/collections", { method: "POST", body: JSON.stringify(collectionPayload(collection)) }, token);

  for (const field of collection.fields) {
    let fieldExists = false;
    try {
      await request(`/fields/${collection.name}/${field.name}`, {}, token);
      fieldExists = true;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    if (!fieldExists) await request(`/fields/${collection.name}`, { method: "POST", body: JSON.stringify(fieldPayload(collection.name, field)) }, token);
  }
}

export async function bootstrap() {
  const schema = JSON.parse(await readFile(new URL("./schema.yaml", import.meta.url), "utf8"));
  const token = await login();
  const me = await request("/users/me?fields=role.admin_access,role.app_access", {}, token);
  console.log(`CMS bootstrap authenticated as administrator access=${Boolean(me.data?.role?.admin_access)}`);
  for (const collection of schema.collections) await ensureCollection(collection, token);

  const settings = JSON.parse(await readFile(new URL("./seed/site-settings.json", import.meta.url), "utf8"));
  let settingsExist = false;
  try {
    await request(`/items/cms_site_settings/${settings.id}`, {}, token);
    settingsExist = true;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  await request(`/items/cms_site_settings${settingsExist ? `/${settings.id}` : ""}`, {
    method: settingsExist ? "PATCH" : "POST",
    body: JSON.stringify(settings),
  }, token);
  return schema.collections.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrap().then((count) => console.log(`CMS bootstrap applied ${count} collections`)).catch((error) => {
    console.error(error.message);
    if (error.detail) console.error(error.detail);
    process.exit(1);
  });
}
