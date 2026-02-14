import React, { useState, useEffect, useRef } from 'react';
import type { Memo, MemoDisplayItem } from '@codedocs/core';
import {
  loadPersonalMemos,
  savePersonalMemos,
  mergeForDisplay,
  promptAuthor,
  exportMemos,
  importMemos,
  formatTimestamp,
} from '../utils/memo-logic.js';
import { useI18n } from '../i18n/index.js';

export interface MemoPanelProps {
  pageSlug: string;
}

export function MemoPanel({ pageSlug }: MemoPanelProps) {
  const { strings } = useI18n();
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
    e.target.value = '';
  };

  return (
    <div className="codedocs-memo-viewer">
      <div className="codedocs-memo-viewer-header">
        <h3 className="codedocs-memo-viewer-title">{strings.memo.title}</h3>
      </div>

      <div className="codedocs-memo-actions">
        <button className="codedocs-memo-action-btn" onClick={exportMemos}>
          {strings.memo.exportAll}
        </button>
        <button className="codedocs-memo-action-btn" onClick={handleImport}>
          {strings.memo.import}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-label={strings.memo.importFile}
        />
      </div>

      <div className="codedocs-memo-editor">
        <textarea
          className="codedocs-memo-textarea"
          placeholder={strings.memo.placeholder}
          value={newMemoText}
          onChange={(e) => setNewMemoText(e.target.value)}
          rows={4}
          aria-label={strings.memo.editorLabel}
        />
        <button
          className="codedocs-memo-save-btn"
          onClick={handleSave}
          disabled={!newMemoText.trim()}
        >
          {strings.memo.addMemo}
        </button>
      </div>

      <div className="codedocs-memo-list">
        {displayItems.length === 0 ? (
          <div className="codedocs-memo-viewer-empty">
            <svg
              className="codedocs-memo-empty-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p className="codedocs-memo-empty-text">{strings.memo.noMemos}</p>
          </div>
        ) : (
          displayItems.map((memo) => (
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
                    {memo.source === 'shared' ? strings.memo.shared : strings.memo.personal}
                  </span>
                  <span className="codedocs-memo-timestamp">
                    {formatTimestamp(memo.createdAt)}
                  </span>
                </div>
                {memo.source === 'personal' && (
                  <button
                    className="codedocs-memo-delete-btn"
                    onClick={() => handleDelete(memo.id)}
                    aria-label={strings.memo.deleteMemo}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="codedocs-memo-text">{memo.text}</div>
            </div>
          )).reverse() // Display newest memos first
        )}
      </div>
    </div>
  );
}
