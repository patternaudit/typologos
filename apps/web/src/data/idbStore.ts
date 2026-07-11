import type {
  Anchor,
  CreateAnchorInput,
  CreateLinkInput,
  HydratedWorkspace,
  LayerExport,
  Link,
  UpdateLinkInput,
} from "@typologos/shared";
import type { UserLayerStore } from "./types";

// Local-first user layer in IndexedDB. Anchors and links live entirely in
// the visitor's browser; the export/import pair makes the layer portable.

const DB_NAME = "typologos-local";
const DB_VERSION = 1;
const LOCAL_WORKSPACE_ID = "local";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("anchors")) {
        const anchors = db.createObjectStore("anchors", { keyPath: "id" });
        anchors.createIndex("documentId", "documentId");
      }
      if (!db.objectStoreNames.contains("links")) {
        db.createObjectStore("links", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result: T;
    Promise.resolve(run(t)).then((r) => (result = r), reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function reqAll<T>(req: IDBRequest<T[]>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export class IdbUserStore implements UserLayerStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  private async allAnchors(): Promise<Anchor[]> {
    const db = await this.db();
    return tx(db, ["anchors"], "readonly", (t) => reqAll(t.objectStore("anchors").getAll()));
  }

  private async allLinks(): Promise<Link[]> {
    const db = await this.db();
    return tx(db, ["links"], "readonly", (t) => reqAll(t.objectStore("links").getAll()));
  }

  async fetchWorkspace(): Promise<HydratedWorkspace> {
    const [anchors, links] = await Promise.all([this.allAnchors(), this.allLinks()]);
    const anchorIds = new Set(links.flatMap((l) => [l.sourceAnchorId, l.targetAnchorId]));
    return {
      workspace: {
        id: LOCAL_WORKSPACE_ID,
        title: "Local workspace",
        createdAt: now(),
        updatedAt: now(),
      },
      // No legacy document panes in local mode; the app falls back to book
      // views.
      panes: [],
      links,
      linkAnchors: anchors.filter((a) => anchorIds.has(a.id)),
    };
  }

  async anchorsForDocument(documentId: string): Promise<Anchor[]> {
    const db = await this.db();
    return tx(db, ["anchors"], "readonly", (t) =>
      reqAll(t.objectStore("anchors").index("documentId").getAll(documentId)),
    );
  }

  async createAnchor(input: CreateAnchorInput): Promise<Anchor> {
    const anchor: Anchor = {
      id: newId(),
      documentId: input.documentId,
      segmentId: input.segmentId ?? null,
      passageRef: input.passageRef,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      selectedText: input.selectedText,
      kind: "text_span",
      createdAt: now(),
      updatedAt: now(),
    };
    const db = await this.db();
    await tx(db, ["anchors"], "readwrite", (t) => void t.objectStore("anchors").put(anchor));
    return anchor;
  }

  async deleteAnchor(id: string): Promise<void> {
    const db = await this.db();
    const links = await this.allLinks();
    await tx(db, ["anchors", "links"], "readwrite", (t) => {
      t.objectStore("anchors").delete(id);
      for (const l of links) {
        if (l.sourceAnchorId === id || l.targetAnchorId === id) {
          t.objectStore("links").delete(l.id);
        }
      }
    });
  }

  async createLink(input: CreateLinkInput): Promise<Link> {
    const link: Link = {
      id: newId(),
      workspaceId: LOCAL_WORKSPACE_ID,
      sourceAnchorId: input.sourceAnchorId,
      targetAnchorId: input.targetAnchorId,
      type: input.type,
      title: input.title ?? null,
      rationale: input.rationale ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    const db = await this.db();
    await tx(db, ["links"], "readwrite", (t) => void t.objectStore("links").put(link));
    return link;
  }

  async updateLink(id: string, input: UpdateLinkInput): Promise<Link> {
    const db = await this.db();
    const links = await this.allLinks();
    const existing = links.find((l) => l.id === id);
    if (!existing) throw new Error("link not found");
    const updated: Link = {
      ...existing,
      type: input.type ?? existing.type,
      title: input.title === undefined ? existing.title : input.title,
      rationale: input.rationale === undefined ? existing.rationale : input.rationale,
      updatedAt: now(),
    };
    await tx(db, ["links"], "readwrite", (t) => void t.objectStore("links").put(updated));
    return updated;
  }

  async deleteLink(id: string): Promise<void> {
    const db = await this.db();
    await tx(db, ["links"], "readwrite", (t) => void t.objectStore("links").delete(id));
  }

  async exportLayer(): Promise<LayerExport> {
    const [anchors, links] = await Promise.all([this.allAnchors(), this.allLinks()]);
    return { app: "typologos", version: 1, exportedAt: now(), anchors, links };
  }

  async importLayer(data: LayerExport): Promise<{ anchorsAdded: number; linksAdded: number }> {
    if (data.app !== "typologos" || !Array.isArray(data.anchors) || !Array.isArray(data.links)) {
      throw new Error("not a Typologos layer file");
    }
    const db = await this.db();
    const [existingAnchors, existingLinks] = await Promise.all([
      this.allAnchors(),
      this.allLinks(),
    ]);
    const haveAnchor = new Set(existingAnchors.map((a) => a.id));
    const haveLink = new Set(existingLinks.map((l) => l.id));
    const newAnchors = data.anchors.filter((a) => !haveAnchor.has(a.id));
    const newLinks = data.links.filter((l) => !haveLink.has(l.id));
    await tx(db, ["anchors", "links"], "readwrite", (t) => {
      for (const a of newAnchors) t.objectStore("anchors").put(a);
      for (const l of newLinks) t.objectStore("links").put({ ...l, workspaceId: LOCAL_WORKSPACE_ID });
    });
    return { anchorsAdded: newAnchors.length, linksAdded: newLinks.length };
  }
}
