import type {
  Anchor,
  BookPassage,
  BookSummary,
  CreateAnchorInput,
  CreateLinkInput,
  HydratedWorkspace,
  Link,
  MotifDetail,
  PassageMotifInstance,
  UpdateLinkInput,
} from "@typologos/shared";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function fetchWorkspace(id: string): Promise<HydratedWorkspace> {
  return fetch(`/api/workspaces/${id}`).then((r) => json<HydratedWorkspace>(r));
}

export function fetchBooks(): Promise<BookSummary[]> {
  return fetch("/api/books").then((r) => json<BookSummary[]>(r));
}

export function fetchBookPassage(documentId: string): Promise<BookPassage> {
  return fetch(`/api/books/${documentId}/passage`).then((r) => json<BookPassage>(r));
}

export function fetchBookMotifs(documentId: string): Promise<PassageMotifInstance[]> {
  return fetch(`/api/books/${documentId}/motifs`).then((r) =>
    json<PassageMotifInstance[]>(r),
  );
}

export function fetchMotifDetail(id: string): Promise<MotifDetail> {
  return fetch(`/api/motifs/${id}`).then((r) => json<MotifDetail>(r));
}

export function createAnchor(input: CreateAnchorInput): Promise<Anchor> {
  return fetch("/api/anchors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => json<Anchor>(r));
}

export function deleteAnchor(id: string): Promise<{ ok: true }> {
  return fetch(`/api/anchors/${id}`, { method: "DELETE" }).then((r) =>
    json<{ ok: true }>(r),
  );
}

export function createLink(input: CreateLinkInput): Promise<Link> {
  return fetch("/api/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => json<Link>(r));
}

export function updateLink(id: string, input: UpdateLinkInput): Promise<Link> {
  return fetch(`/api/links/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => json<Link>(r));
}

export function deleteLink(id: string): Promise<{ ok: true }> {
  return fetch(`/api/links/${id}`, { method: "DELETE" }).then((r) =>
    json<{ ok: true }>(r),
  );
}
