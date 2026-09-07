import type { GitHubFileClient } from "./github.js";
import { renderSettingsModule, sanitizeSettings } from "./settings.js";

export async function exportSettingsToGitHub(client: GitHubFileClient, settings: Record<string, unknown>): Promise<string> {
  const safeSettings = sanitizeSettings(settings);
  return client.putFile({
    path: "src/generated/cms-settings.ts",
    content: renderSettingsModule(safeSettings),
    message: "[cms-export] update site settings",
  });
}
