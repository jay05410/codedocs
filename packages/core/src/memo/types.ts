/**
 * Memo system types for file-based storage with stable page IDs.
 *
 * Storage model:
 *   .codedocs/memos.json  → git-committable shared memos
 *   localStorage           → personal draft memos
 */

export interface Memo {
  /** Unique memo identifier: memo-{timestamp}-{random9} */
  id: string;
  /** Page slug used as stable identifier: "api/user-controller" */
  pageId: string;
  /** Memo body text */
  text: string;
  /** Author display name */
  author: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-edit timestamp */
  updatedAt?: string;
}

export interface MemoStore {
  version: 1;
  /** pageId → array of memos */
  memos: Record<string, Memo[]>;
}

export interface MemoDisplayItem extends Memo {
  /** Whether this memo came from the shared store or personal localStorage */
  source: 'shared' | 'personal';
}
