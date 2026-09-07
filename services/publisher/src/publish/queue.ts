import { exportPostToGitHub, type GitHubFileClient } from "../export/github.js";
import type { ExportablePost } from "../export/markdown.js";

export interface PublicationQueue {
  enqueue(post: ExportablePost, syncedAt: string): void;
}

export class NoopPublicationQueue implements PublicationQueue {
  enqueue(): void {}
}

export class GitHubPublicationQueue implements PublicationQueue {
  private tail = Promise.resolve();

  constructor(private readonly client: GitHubFileClient, private readonly onError: (error: unknown) => void = () => undefined) {}

  enqueue(post: ExportablePost, syncedAt: string): void {
    const job = this.tail.then(() => exportPostToGitHub(this.client, post, syncedAt));
    this.tail = job.then(() => undefined, (error) => this.onError(error));
  }
}
