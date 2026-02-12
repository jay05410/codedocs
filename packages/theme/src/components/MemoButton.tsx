import React, { useState, useEffect, useRef } from 'react';
import type { Memo, MemoStore, MemoDisplayItem } from '@codedocs/core';
import { parseMemoStore, createEmptyMemoStore, mergeMemoStores } from '@codedocs/core';
import sharedMemoStore from 'virtual:codedocs-memos';

export interface MemoButtonProps {
  pageSlug: string;
  className?: string;
}

const AUTHOR_KEY = 'codedocs-memo-author';
const STORAGE_PREFIX = 'codedocs-memos-';

function getAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) || '';
  } catch {
    return '';
  }
}

function promptAuthor(): string {
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

function loadPersonalMemos(pageSlug: string): Memo[] {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + pageSlug);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Legacy migration: backfill author and pageId
    return (parsed as Memo[]).map((m) => ({
      ...m,
      author: m.author || getAuthor() || 'Anonymous',
      pageId: m.pageId || pageSlug,
    }));
  } catch {
    return [];
  }
}

function savePersonalMemos(pageSlug: string, memos: Memo[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + pageSlug, JSON.stringify(memos));
  } catch (error) {
    console.error('Failed to save memos:', error);
  }
}

function getSharedMemosForPage(pageSlug: string): Memo[] {
  const store = parseMemoStore(sharedMemoStore);
  return store.memos[pageSlug] ?? [];
}

function mergeForDisplay(pageSlug: string, personal: Memo[]): MemoDisplayItem[] {
  const shared = getSharedMemosForPage(pageSlug);
  const personalIds = new Set(personal.map((m) => m.id));

  const items: MemoDisplayItem[] = [];

  // Shared memos that are not also in personal (avoid duplicates)
  for (const m of shared) {
    if (!personalIds.has(m.id)) {
      items.push({ ...m, source: 'shared' });
    }
  }

  // All personal memos
  for (const m of personal) {
    items.push({ ...m, source: 'personal' });
  }

  // Sort chronologically
  items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return items;
}

/** Collect all personal memos across all pages from localStorage. */
function collectAllPersonalMemos(): MemoStore {
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

function exportMemos(): void {
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

function importMemos(file: File, pageSlug: string, onDone: () => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = parseMemoStore(reader.result as string);
      // Merge each page's memos into localStorage
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

export function MemoButton({ pageSlug, className = '' }: MemoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [personalMemos, setPersonalMemos] = useState<Memo[]>([]);
  const [displayItems, setDisplayItems] = useState<MemoDisplayItem[]>([]);
  const [newMemoText, setNewMemoText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    reload();
  }, [pageSlug]);

  const reload = () => {
    const personal = loadPersonalMemos(pageSlug);
    setPersonalMemos(personal);
    setDisplayItems(mergeForDisplay(pageSlug, personal));
  };

  const handleSave = () => {
    if (!newMemoText.trim()) return;

    const author = promptAuthor();
    const newMemo: Memo = {
      id: `memo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      pageId: pageSlug,
      text: newMemoText.trim(),
      author,
      createdAt: new Date().toISOString(),
    };

    const updated = [...personalMemos, newMemo];
    savePersonalMemos(pageSlug, updated);
    setPersonalMemos(updated);
    setDisplayItems(mergeForDisplay(pageSlug, updated));
    setNewMemoText('');
  };

  const handleDelete = (id: string) => {
    // Only personal memos can be deleted
    const updated = personalMemos.filter((m) => m.id !== id);
    savePersonalMemos(pageSlug, updated);
    setPersonalMemos(updated);
    setDisplayItems(mergeForDisplay(pageSlug, updated));
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importMemos(file, pageSlug, reload);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  };

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <button
        className={`codedocs-memo-button ${className}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Page memos"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
            fill="currentColor"
          />
        </svg>
        {displayItems.length > 0 && (
          <span className="codedocs-memo-badge">{displayItems.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="codedocs-memo-panel">
          <div className="codedocs-memo-panel-header">
            <h3>Page Memos</h3>
            <button
              className="codedocs-memo-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close memo panel"
            >
              ×
            </button>
          </div>

          <div className="codedocs-memo-panel-content">
            {/* Export / Import actions */}
            <div className="codedocs-memo-actions">
              <button className="codedocs-memo-action-btn" onClick={exportMemos}>
                Export All
              </button>
              <button className="codedocs-memo-action-btn" onClick={handleImport}>
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            {/* New memo editor */}
            <div className="codedocs-memo-editor">
              <textarea
                className="codedocs-memo-textarea"
                placeholder="Write a memo for this page..."
                value={newMemoText}
                onChange={(e) => setNewMemoText(e.target.value)}
                rows={4}
              />
              <button
                className="codedocs-memo-save-btn"
                onClick={handleSave}
                disabled={!newMemoText.trim()}
              >
                Save Memo
              </button>
            </div>

            {/* Memo list */}
            {displayItems.length > 0 && (
              <div className="codedocs-memo-list">
                {displayItems.map((memo) => (
                  <div key={memo.id} className="codedocs-memo-item">
                    <div className="codedocs-memo-item-header">
                      <div className="codedocs-memo-item-meta">
                        <span className="codedocs-memo-author">{memo.author}</span>
                        <span
                          className={`codedocs-memo-source-badge ${
                            memo.source === 'shared'
                              ? 'codedocs-memo-badge-shared'
                              : 'codedocs-memo-badge-personal'
                          }`}
                        >
                          {memo.source === 'shared' ? 'Shared' : 'Personal'}
                        </span>
                        <span className="codedocs-memo-timestamp">
                          {formatTimestamp(memo.createdAt)}
                        </span>
                      </div>
                      {memo.source === 'personal' && (
                        <button
                          className="codedocs-memo-delete-btn"
                          onClick={() => handleDelete(memo.id)}
                          aria-label="Delete memo"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="codedocs-memo-text">{memo.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
