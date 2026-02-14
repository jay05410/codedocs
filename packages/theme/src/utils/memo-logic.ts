import type { Memo, MemoStore, MemoDisplayItem } from '@codedocs/core';
import { parseMemoStore, createEmptyMemoStore, mergeMemoStores } from '@codedocs/core';
// @ts-ignore
import sharedMemoStore from 'virtual:codedocs-memos';

const AUTHOR_KEY = 'codedocs-memo-author';
const STORAGE_PREFIX = 'codedocs-memos-';

export function getAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) || '';
  } catch {
    return '';
  }
}

export function promptAuthor(): string {
  const existing = getAuthor();
  if (existing) return existing;
  const name = window.prompt('Enter your name for memos:')?.trim() || 'Anonymous';
  try {
    localStorage.setItem(AUTHOR_KEY, name);
  } catch {
    // ignore
  }
  return name;
}

export function loadPersonalMemos(pageSlug: string): Memo[] {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + pageSlug);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Memo[]).map((m) => ({
      ...m,
      author: m.author || getAuthor() || 'Anonymous',
      pageId: m.pageId || pageSlug,
    }));
  } catch {
    return [];
  }
}

export function savePersonalMemos(pageSlug: string, memos: Memo[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + pageSlug, JSON.stringify(memos));
  } catch (error) {
    console.error('Failed to save memos:', error);
  }
}

export function getSharedMemosForPage(pageSlug: string): Memo[] {
  try {
    const store = parseMemoStore(sharedMemoStore);
    return store.memos[pageSlug] ?? [];
  } catch {
    return [];
  }
}

export function mergeForDisplay(pageSlug: string, personal: Memo[]): MemoDisplayItem[] {
  const shared = getSharedMemosForPage(pageSlug);
  const personalIds = new Set(personal.map((m) => m.id));

  const items: MemoDisplayItem[] = [];

  for (const m of shared) {
    if (!personalIds.has(m.id)) {
      items.push({ ...m, source: 'shared' });
    }
  }

  for (const m of personal) {
    items.push({ ...m, source: 'personal' });
  }

  items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return items;
}

export function collectAllPersonalMemos(): MemoStore {
  const store = createEmptyMemoStore();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const pageId = key.slice(STORAGE_PREFIX.length);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        const memos: Memo[] = parsed.map((m: Memo) => ({
          ...m,
          author: m.author || getAuthor() || 'Anonymous',
          pageId: m.pageId || pageId,
        }));
        if (memos.length > 0) {
          store.memos[pageId] = memos;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }
  return store;
}

export function exportMemos(): void {
  const personal = collectAllPersonalMemos();
  const shared = parseMemoStore(sharedMemoStore);
  const merged = mergeMemoStores(shared, personal);
  const json = JSON.stringify(merged, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'memos.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importMemos(file: File, pageSlug: string, onDone: () => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = parseMemoStore(reader.result as string);
      for (const [pageId, memos] of Object.entries(imported.memos)) {
        const existing = loadPersonalMemos(pageId);
        const existingIds = new Set(existing.map((m) => m.id));
        const newMemos = memos.filter((m) => !existingIds.has(m.id));
        if (newMemos.length > 0) {
          savePersonalMemos(pageId, [...existing, ...newMemos]);
        }
      }
      onDone();
    } catch (error) {
      console.error('Failed to import memos:', error);
    }
  };
  reader.readAsText(file);
}

export const formatTimestamp = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
