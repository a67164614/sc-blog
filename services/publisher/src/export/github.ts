import { exportPostMarkdown, postOutputPath, type ExportablePost } from "./markdown.js";
import type { PublisherConfig } from "../config.js";

export type GitHubPutFileInput = { path: string; content: string; message: string };

export interface GitHubFileClient {
  putFile(input: GitHubPutFileInput): Promise<string>;
}

export async function exportPostToGitHub(client: GitHubFileClient, post: ExportablePost, syncedAt: string): Promise<string | null> {
  const content = exportPostMarkdown(post, syncedAt);
  if (!content) return null;
  return client.putFile({ path: postOutputPath(post), content, message: `[cms-export] publish ${post.source}/${post.externalId}` });
}

function repositoryPath(repositoryUrl: string): { owner: string; repo: string } {
  const url = new URL(repositoryUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  const repo = parts.pop()?.replace(/\.git$/, "");
  const owner = parts.pop();
  if (url.hostname !== "github.com" || !owner || !repo) throw new Error("CONTENT_REPOSITORY must be a GitHub repository URL");
  return { owner, repo };
}

export class GitHubContentsClient implements GitHubFileClient {
  private readonly owner: string;
  private readonly repo: string;

  constructor(private readonly config: PublisherConfig) {
    ({ owner: this.owner, repo: this.repo } = repositoryPath(config.CONTENT_REPOSITORY));
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${this.config.GITHUB_API_URL}/repos/${this.owner}/${this.repo}/contents/${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.config.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }

  async putFile(input: GitHubPutFileInput): Promise<string> {
    const encodedPath = input.path.split("/").map(encodeURIComponent).join("/");
    const existing = await this.request(`${encodedPath}?ref=${encodeURIComponent(this.config.GITHUB_BRANCH)}`);
    let sha: string | undefined;
    if (existing.ok) {
      const body = (await existing.json()) as { sha?: string };
      sha = body.sha;
    } else if (existing.status !== 404) {
      throw new Error(`GitHub file lookup failed with status ${existing.status}`);
    }

    const response = await this.request(encodedPath, {
      method: "PUT",
      body: JSON.stringify({
        message: input.message,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: this.config.GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!response.ok) throw new Error(`GitHub file update failed with status ${response.status}`);
    const body = (await response.json()) as { commit?: { sha?: string } };
    if (!body.commit?.sha) throw new Error("GitHub file update returned no commit SHA");
    return body.commit.sha;
  }
}
