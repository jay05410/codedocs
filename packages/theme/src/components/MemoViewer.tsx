import React, { useState, useEffect } from 'react';

export interface MemoViewerProps {
  pageSlug: string;
  className?: string;
}

interface Memo {
  id: string;
  text: string;
  createdAt: string;
}

export function MemoViewer({ pageSlug, className = '' }: MemoViewerProps) {
  const [memos, setMemos] = useState<Memo[]>([]);

  const storageKey = `codedocs-memos-${pageSlug}`;

  useEffect(() => {
    loadMemos();
  }, [pageSlug]);

  const loadMemos = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setMemos(JSON.parse(stored));
      } else {
        setMemos([]);
      }
    } catch (error) {
      console.error('Failed to load memos:', error);
      setMemos([]);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to delete all memos for this page?')) {
      try {
        localStorage.removeItem(storageKey);
        setMemos([]);
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

  if (memos.length === 0) {
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

  return (
    <div className={`codedocs-memo-viewer ${className}`}>
      <div className="codedocs-memo-viewer-header">
        <h3 className="codedocs-memo-viewer-title">Page Memos ({memos.length})</h3>
        <button className="codedocs-memo-clear-btn" onClick={handleClearAll}>
          Clear All
        </button>
      </div>

      <div className="codedocs-memo-viewer-list">
        {memos.map((memo) => (
          <div key={memo.id} className="codedocs-memo-viewer-item">
            <div className="codedocs-memo-viewer-time">
              {getRelativeTime(memo.createdAt)}
            </div>
            <div className="codedocs-memo-viewer-text">{memo.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
