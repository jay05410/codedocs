export type { Memo, MemoStore, MemoDisplayItem } from './types.js';

import type { Memo, MemoStore } from './types.js';

/** Create an empty MemoStore with version field. */
export function createEmptyMemoStore(): MemoStore {
  return { version: 1, memos: {} };
}

/**
 * Parse a JSON string (or object) into a validated MemoStore.
 * Returns an empty store on invalid input.
 */
export function parseMemoStore(input: string | unknown): MemoStore {
  try {
    const obj = typeof input === 'string' ? JSON.parse(input) : input;
    if (
      obj &&
      typeof obj === 'object' &&
      obj.version === 1 &&
      obj.memos &&
      typeof obj.memos === 'object'
    ) {
      return obj as MemoStore;
    }
  } catch {
    // fall through
  }
  return createEmptyMemoStore();
}

/**
 * Merge two MemoStores. Memos are deduplicated by `id`.
 * When both stores contain a memo with the same id, `secondary` wins
 * (this lets personal edits override shared copies).
 */
export function mergeMemoStores(primary: MemoStore, secondary: MemoStore): MemoStore {
  const merged: MemoStore = { version: 1, memos: {} };

  // Collect all pageIds from both stores
  const allPageIds = new Set([
    ...Object.keys(primary.memos),
    ...Object.keys(secondary.memos),
  ]);

  for (const pageId of allPageIds) {
    const primaryMemos = primary.memos[pageId] ?? [];
    const secondaryMemos = secondary.memos[pageId] ?? [];

    // Index secondary memos by id for dedup
    const byId = new Map<string, Memo>();
    for (const m of primaryMemos) {
      byId.set(m.id, m);
    }
    for (const m of secondaryMemos) {
      byId.set(m.id, m); // secondary wins
    }

    merged.memos[pageId] = Array.from(byId.values()).sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime() || 0;
      const bTime = new Date(b.createdAt).getTime() || 0;
      return aTime - bTime;
    });
  }

  return merged;
}
