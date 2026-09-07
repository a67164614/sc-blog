import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSettings, renderSettingsModule } from "../src/export/settings.js";

test("settings snapshot keeps display configuration and drops secrets", () => {
  const snapshot = sanitizeSettings({
    identity: { title: "Sc 的个人博客", subtitle: "" },
    appearance: { themeColor: "#123456" },
    integrations: { token: "must-not-export" },
    adminPassword: "must-not-export",
  });
  assert.deepEqual(snapshot, { identity: { title: "Sc 的个人博客", subtitle: "" }, appearance: { themeColor: "#123456" } });
  assert.doesNotMatch(renderSettingsModule(snapshot), /must-not-export/);
});
