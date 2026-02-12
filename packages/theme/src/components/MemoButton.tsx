import React, { useState, useEffect } from 'react';

export interface MemoButtonProps {
  pageSlug: string;
  className?: string;
}

interface Memo {
  id: string;
  text: string;
  createdAt: string;
}

export function MemoButton({ pageSlug, className = '' }: MemoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [newMemoText, setNewMemoText] = useState('');

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

  const saveMemos = (updatedMemos: Memo[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedMemos));
      setMemos(updatedMemos);
    } catch (error) {
      console.error('Failed to save memos:', error);
    }
  };

  const handleSave = () => {
    if (!newMemoText.trim()) return;

    const newMemo: Memo = {
      id: `memo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: newMemoText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedMemos = [...memos, newMemo];
    saveMemos(updatedMemos);
    setNewMemoText('');
  };

  const handleDelete = (id: string) => {
    const updatedMemos = memos.filter((memo) => memo.id !== id);
    saveMemos(updatedMemos);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
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
        onClick={handleToggle}
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
        {memos.length > 0 && (
          <span className="codedocs-memo-badge">{memos.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="codedocs-memo-panel">
          <div className="codedocs-memo-panel-header">
            <h3>Page Memos</h3>
            <button
              className="codedocs-memo-close"
              onClick={handleClose}
              aria-label="Close memo panel"
            >
              ×
            </button>
          </div>

          <div className="codedocs-memo-panel-content">
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

            {memos.length > 0 && (
              <div className="codedocs-memo-list">
                {memos.map((memo) => (
                  <div key={memo.id} className="codedocs-memo-item">
                    <div className="codedocs-memo-item-header">
                      <span className="codedocs-memo-timestamp">
                        {formatTimestamp(memo.createdAt)}
                      </span>
                      <button
                        className="codedocs-memo-delete-btn"
                        onClick={() => handleDelete(memo.id)}
                        aria-label="Delete memo"
                      >
                        ×
                      </button>
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
