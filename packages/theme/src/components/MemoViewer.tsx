import React, { useState, useEffect } from 'react';
import type { Memo, MemoDisplayItem } from '@codedocs/core';
import { parseMemoStore } from '@codedocs/core';
import sharedMemoStore from 'virtual:codedocs-memos';

export interface MemoViewerProps {
  pageSlug: string;
  className?: string;
}

const STORAGE_PREFIX = 'codedocs-memos-';
const AUTHOR_KEY = 'codedocs-memo-author';

function getAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) || '';
  } catch {
    return '';
  }
}

function loadPersonalMemos(pageSlug: string): Memo[] {
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

function getSharedMemosForPage(pageSlug: string): Memo[] {
  const store = parseMemoStore(sharedMemoStore);
  return store.memos[pageSlug] ?? [];
}

function mergeForDisplay(pageSlug: string, personal: Memo[]): MemoDisplayItem[] {
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

export function MemoViewer({ pageSlug, className = '' }: MemoViewerProps) {
  const [displayItems, setDisplayItems] = useState<MemoDisplayItem[]>([]);

  useEffect(() => {
    const personal = loadPersonalMemos(pageSlug);
    setDisplayItems(mergeForDisplay(pageSlug, personal));
  }, [pageSlug]);

  const handleClearAll = () => {
    if (window.confirm('Clear all personal memos for this page? Shared memos will remain.')) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + pageSlug);
        // Re-merge: only shared remain
        setDisplayItems(mergeForDisplay(pageSlug, []));
      } catch (error) {
        console.error('Failed to clear memos:', error);
      }
    }
  };

  const getRelativeTime = (isoString: string): string => {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return 'just now';
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    } else {
      return past.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (displayItems.length === 0) {
    return (
      <div className={`codedocs-memo-viewer ${className}`}>
        <div className="codedocs-memo-viewer-empty">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="codedocs-memo-empty-icon"
          >
            <path
              d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
              fill="currentColor"
              opacity="0.3"
            />
          </svg>
          <p className="codedocs-memo-empty-text">No memos for this page yet</p>
        </div>
      </div>
    );
  }

  const hasPersonal = displayItems.some((m) => m.source === 'personal');

  return (
    <div className={`codedocs-memo-viewer ${className}`}>
      <div className="codedocs-memo-viewer-header">
        <h3 className="codedocs-memo-viewer-title">Page Memos ({displayItems.length})</h3>
        {hasPersonal && (
          <button className="codedocs-memo-clear-btn" onClick={handleClearAll}>
            Clear Personal
          </button>
        )}
      </div>

      <div className="codedocs-memo-viewer-list">
        {displayItems.map((memo) => (
          <div key={memo.id} className="codedocs-memo-viewer-item">
            <div className="codedocs-memo-viewer-time">
              <span className="codedocs-memo-item-meta">
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
                <span>{getRelativeTime(memo.createdAt)}</span>
              </span>
            </div>
            <div className="codedocs-memo-viewer-text">{memo.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
