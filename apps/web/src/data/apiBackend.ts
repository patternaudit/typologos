import type {
  Anchor,
  CreateAnchorInput,
  CreateLinkInput,
  HydratedWorkspace,
  LayerExport,
  Link,
  UpdateLinkInput,
} from "@typologos/shared";
import * as client from "../api/client";
import type { CorpusSource, UserLayerStore } from "./types";

// Thin wrappers around the Hono API — the "there is a server" backends.

export class ApiCorpus implements CorpusSource {
  fetchBooks = client.fetchBooks;
  fetchBookPassage = client.fetchBookPassage;
  fetchBookMotifs = client.fetchBookMotifs;
  fetchMotifDetail = client.fetchMotifDetail;
  fetchMotifIndex = client.fetchMotifIndex;
  fetchParallels = client.fetchParallels;
  fetchOverviewStructure = client.fetchOverviewStructure;
  fetchOverviewConnections = client.fetchOverviewConnections;
}

export class ApiUserStore implements UserLayerStore {
  constructor(private workspaceId: string) {}

  fetchWorkspace(id: string): Promise<HydratedWorkspace> {
    return client.fetchWorkspace(id);
  }
  createAnchor(input: CreateAnchorInput): Promise<Anchor> {
    return client.createAnchor(input);
  }
  async deleteAnchor(id: string): Promise<void> {
    await client.deleteAnchor(id);
  }
  createLink(input: CreateLinkInput): Promise<Link> {
    return client.createLink(input);
  }
  updateLink(id: string, input: UpdateLinkInput): Promise<Link> {
    return client.updateLink(id, input);
  }
  async deleteLink(id: string): Promise<void> {
    await client.deleteLink(id);
  }
  // The API merges anchors into passages server-side; nothing extra to merge.
  async anchorsForDocument(): Promise<Anchor[]> {
    return [];
  }
  async exportLayer(): Promise<LayerExport> {
    const res = await fetch("/api/layer");
    if (!res.ok) throw new Error(`export failed: ${res.status}`);
    return res.json() as Promise<LayerExport>;
  }
  async importLayer(data: LayerExport): Promise<{ anchorsAdded: number; linksAdded: number }> {
    const res = await fetch("/api/layer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, workspaceId: this.workspaceId }),
    });
    if (!res.ok) throw new Error(`import failed: ${res.status}`);
    return res.json() as Promise<{ anchorsAdded: number; linksAdded: number }>;
  }
}
