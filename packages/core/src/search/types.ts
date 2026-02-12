export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  type: 'endpoint' | 'entity' | 'service' | 'type' | 'page' | 'custom';
  path: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  document: SearchDocument;
  score: number;
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  field: string;
  snippet: string;
  positions: [number, number][];
}

export interface SearchOptions {
  /** Maximum number of results */
  limit?: number;
  /** Minimum relevance score (0-1) */
  threshold?: number;
  /** Filter by document type */
  types?: SearchDocument['type'][];
  /** Filter by tags */
  tags?: string[];
  /** Use AI-enhanced reranking */
  aiRerank?: boolean;
}

export interface SearchIndex {
  documents: SearchDocument[];
  embeddings: Map<string, number[]>;
  vocabulary: Map<string, number>;
  idfScores: Map<string, number>;
  version: string;
}

export interface EmbeddingProvider {
  /** Generate embedding vector for text */
  embed(text: string): Promise<number[]>;
  /** Generate embeddings for multiple texts (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Embedding dimension size */
  dimensions: number;
}
