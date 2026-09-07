import type { FastifyInstance } from "fastify";
import type { GitHubFileClient } from "../export/github.js";
import { exportSettingsToGitHub } from "../export/settings-github.js";

function validToken(actual: string | undefined, expected: string): boolean {
  return actual === `Bearer ${expected}`;
}

export function registerSettingsRoute(app: FastifyInstance, internalToken: string, client: GitHubFileClient): void {
  app.post<{ Body: Record<string, unknown> }>("/api/cms/settings", async (request, reply) => {
    if (!validToken(request.headers.authorization, internalToken)) return reply.code(401).send({ error: "unauthorized" });
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) return reply.code(422).send({ error: "invalid_settings" });
    try {
      const commitSha = await exportSettingsToGitHub(client, request.body);
      return reply.code(202).send({ status: "queued", commitSha });
    } catch {
      return reply.code(503).send({ error: "publisher_unavailable" });
    }
  });
}
