import type { AiProvider } from '../ai/types.js';
import type { AnalysisResult } from '../parser/types.js';
import type { SearchDocument, SearchResult, SearchOptions, SearchIndex, SearchHighlight, EmbeddingProvider } from './types.js';

/**
 * AI-powered semantic search engine for documentation
 * Combines TF-IDF text search with optional AI embedding-based semantic search
 */
export class SemanticSearch {
  private index: SearchIndex | null = null;
  private embeddingProvider: EmbeddingProvider | null = null;

  constructor(
    private aiProvider?: AiProvider,
    embeddingProvider?: EmbeddingProvider,
  ) {
    this.embeddingProvider = embeddingProvider || null;
  }

  /**
   * Build search index from analysis results
   */
  async buildIndex(analysis: AnalysisResult): Promise<SearchIndex> {
    const documents = this.analysisToDocuments(analysis);
    const vocabulary = buildVocabulary(documents);
    const idfScores = computeIdf(documents, vocabulary);
    const embeddings = new Map<string, number[]>();

    // Generate embeddings if provider is available
    if (this.embeddingProvider) {
      const texts = documents.map((d) => `${d.title} ${d.content}`);
      const vectors = await this.embeddingProvider.embedBatch(texts);
      for (let i = 0; i < documents.length; i++) {
        embeddings.set(documents[i].id, vectors[i]);
      }
    }

    this.index = {
      documents,
      embeddings,
      vocabulary,
      idfScores,
      version: '1.0',
    };

    return this.index;
  }

  /**
   * Load a previously built index
   */
  loadIndex(index: SearchIndex): void {
    // Restore Maps from plain objects if deserialized from JSON
    if (!(index.embeddings instanceof Map)) {
      index.embeddings = new Map(Object.entries(index.embeddings));
    }
    if (!(index.vocabulary instanceof Map)) {
      index.vocabulary = new Map(Object.entries(index.vocabulary));
    }
    if (!(index.idfScores instanceof Map)) {
      index.idfScores = new Map(Object.entries(index.idfScores));
    }
    this.index = index;
  }

  /**
   * Serialize index for persistence
   */
  serializeIndex(): string {
    if (!this.index) throw new Error('No index built. Call buildIndex first.');

    return JSON.stringify({
      ...this.index,
      embeddings: Object.fromEntries(this.index.embeddings),
      vocabulary: Object.fromEntries(this.index.vocabulary),
      idfScores: Object.fromEntries(this.index.idfScores),
    });
  }

  /**
   * Search documents by query
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.index) throw new Error('No index built. Call buildIndex first.');

    const {
      limit = 10,
      threshold = 0.1,
      types,
      tags,
      aiRerank = false,
    } = options;

    // Filter documents
    let candidates = this.index.documents;
    if (types?.length) {
      candidates = candidates.filter((d) => types.includes(d.type));
    }
    if (tags?.length) {
      candidates = candidates.filter((d) => d.tags?.some((t) => tags.includes(t)));
    }

    // Get query embedding if available
    const hasEmbeddings = this.index.embeddings.size > 0 && this.embeddingProvider;
    let queryEmbedding: number[] | null = null;
    if (hasEmbeddings && this.embeddingProvider) {
      queryEmbedding = await this.embeddingProvider.embed(query);
    }

    // Score by TF-IDF and embeddings
    let results = candidates.map((doc) => {
      const tfidfScore = computeTfidfSimilarity(
        query,
        `${doc.title} ${doc.content}`,
        this.index!.vocabulary,
        this.index!.idfScores,
      );

      // Boost title matches
      const titleBoost = computeTitleBoost(query, doc.title);

      // Embedding similarity
      let embeddingScore = 0;
      if (queryEmbedding && this.index!.embeddings.has(doc.id)) {
        const docEmbedding = this.index!.embeddings.get(doc.id)!;
        embeddingScore = cosineSimilarity(queryEmbedding, docEmbedding);
      }

      const score = hasEmbeddings
        ? tfidfScore * 0.5 + titleBoost * 0.2 + embeddingScore * 0.3
        : tfidfScore * 0.7 + titleBoost * 0.3;
      const highlights = extractHighlights(query, doc);

      return { document: doc, score, highlights };
    });

    // Filter by threshold and sort
    results = results
      .filter((r) => r.score >= threshold)
      .sort((a, b) => b.score - a.score);

    // AI-enhanced reranking
    if (aiRerank && this.aiProvider && results.length > 0) {
      results = await this.aiRerank(query, results.slice(0, Math.min(limit * 3, 30)));
    }

    // Embedding-based search if provider available and TF-IDF yields few results
    if (this.embeddingProvider && results.length < limit) {
      const embeddingResults = await this.embeddingSearch(query, candidates, results);
      results = mergeResults(results, embeddingResults);
    }

    return results.slice(0, limit);
  }

  /**
   * AI-powered query suggestion/completion
   */
  async suggest(partialQuery: string, maxSuggestions = 5): Promise<string[]> {
    if (!this.index) return [];

    // Extract keywords from index
    const allTerms = Array.from(this.index.vocabulary.keys());
    const queryTerms = tokenize(partialQuery.toLowerCase());
    const lastTerm = queryTerms[queryTerms.length - 1] || '';

    // Find matching terms
    const matches = allTerms
      .filter((t) => t.startsWith(lastTerm) && t !== lastTerm)
      .sort((a, b) => (this.index!.idfScores.get(b) || 0) - (this.index!.idfScores.get(a) || 0))
      .slice(0, maxSuggestions);

    // Build full suggestions
    const prefix = queryTerms.slice(0, -1).join(' ');
    return matches.map((m) => prefix ? `${prefix} ${m}` : m);
  }

  /**
   * Find related documents
   */
  async findRelated(documentId: string, limit = 5): Promise<SearchResult[]> {
    if (!this.index) return [];

    const doc = this.index.documents.find((d) => d.id === documentId);
    if (!doc) return [];

    // Use document content as query
    const results = await this.search(`${doc.title} ${doc.tags?.join(' ') || ''}`, {
      limit: limit + 1,
      threshold: 0.05,
    });

    // Remove the source document itself
    return results.filter((r) => r.document.id !== documentId).slice(0, limit);
  }

  // ── Private Methods ──

  private analysisToDocuments(analysis: AnalysisResult): SearchDocument[] {
    const docs: SearchDocument[] = [];

    // Endpoints
    for (const ep of analysis.endpoints) {
      docs.push({
        id: `ep:${ep.handlerClass}:${ep.name}`,
        title: ep.name,
        content: [
          ep.description || '',
          `${ep.httpMethod || ep.operationType || ''} ${ep.path || ep.fieldName || ''}`,
          `Handler: ${ep.handler}`,
          `Returns: ${ep.returnType}`,
          ep.parameters.map((p) => `${p.name}: ${p.type}`).join(', '),
          ep.tags?.join(' ') || '',
        ].join(' '),
        type: 'endpoint',
        path: ep.filePath,
        tags: ep.tags,
        metadata: { method: ep.httpMethod, path: ep.path, protocol: ep.protocol },
      });
    }

    // Entities
    for (const entity of analysis.entities) {
      docs.push({
        id: `entity:${entity.name}`,
        title: entity.name,
        content: [
          entity.description || '',
          `Table: ${entity.tableName}`,
          `DB: ${entity.dbType}`,
          entity.columns.map((c) => `${c.name}: ${c.type}`).join(', '),
          entity.relations.map((r) => `${r.type} -> ${r.target}`).join(', '),
        ].join(' '),
        type: 'entity',
        path: entity.filePath,
        tags: [entity.dbType],
      });
    }

    // Services
    for (const svc of analysis.services) {
      docs.push({
        id: `svc:${svc.name}`,
        title: svc.name,
        content: [
          svc.description || '',
          `Methods: ${svc.methods.join(', ')}`,
          `Dependencies: ${svc.dependencies.join(', ')}`,
        ].join(' '),
        type: 'service',
        path: svc.filePath,
      });
    }

    // Types
    for (const type of analysis.types) {
      docs.push({
        id: `type:${type.name}`,
        title: type.name,
        content: [
          type.description || '',
          `Kind: ${type.kind}`,
          type.fields.map((f) => `${f.name}: ${f.type}`).join(', '),
        ].join(' '),
        type: 'type',
        path: type.filePath,
        tags: [type.kind],
      });
    }

    return docs;
  }

  private async embeddingSearch(
    query: string,
    candidates: SearchDocument[],
    existingResults: SearchResult[],
  ): Promise<SearchResult[]> {
    if (!this.embeddingProvider || !this.index) return [];

    const queryEmbedding = await this.embeddingProvider.embed(query);
    const existingIds = new Set(existingResults.map((r) => r.document.id));

    const results: SearchResult[] = [];

    for (const doc of candidates) {
      if (existingIds.has(doc.id)) continue;

      const docEmbedding = this.index.embeddings.get(doc.id);
      if (!docEmbedding) continue;

      const score = cosineSimilarity(queryEmbedding, docEmbedding);
      if (score > 0.3) {
        results.push({
          document: doc,
          score,
          highlights: extractHighlights(query, doc),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async aiRerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    if (!this.aiProvider) return results;

    try {
      const candidates = results.map((r, i) => ({
        index: i,
        title: r.document.title,
        snippet: r.document.content.substring(0, 200),
      }));

      const response = await this.aiProvider.chat([
        {
          role: 'system',
          content: 'You are a search result reranker. Given a query and candidate results, return a JSON array of indices sorted by relevance. Return only the JSON array of numbers.',
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nCandidates:\n${candidates.map((c) => `[${c.index}] ${c.title}: ${c.snippet}`).join('\n')}\n\nReturn JSON array of indices sorted by relevance:`,
        },
      ], { temperature: 0, jsonMode: true });

      const ranked = JSON.parse(response);
      if (Array.isArray(ranked)) {
        return ranked
          .filter((i: number) => i >= 0 && i < results.length)
          .map((i: number, rank: number) => ({
            ...results[i],
            score: 1 - rank * (1 / ranked.length), // Normalize scores
          }));
      }
    } catch {
      // Fallback to original ranking
    }

    return results;
  }
}

// ── TF-IDF Implementation ──

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function buildVocabulary(documents: SearchDocument[]): Map<string, number> {
  const vocab = new Map<string, number>();
  let idx = 0;

  for (const doc of documents) {
    const tokens = tokenize(`${doc.title} ${doc.content}`);
    for (const token of tokens) {
      if (!vocab.has(token)) {
        vocab.set(token, idx++);
      }
    }
  }

  return vocab;
}

function computeIdf(documents: SearchDocument[], vocabulary: Map<string, number>): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;

  for (const term of vocabulary.keys()) {
    const df = documents.filter((d) =>
      tokenize(`${d.title} ${d.content}`).includes(term)
    ).length;
    idf.set(term, Math.log((N + 1) / (df + 1)) + 1);
  }

  return idf;
}

function computeTfidf(text: string, vocabulary: Map<string, number>, idfScores: Map<string, number>): Map<string, number> {
  const tokens = tokenize(text);
  const tf = new Map<string, number>();

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  const tfidf = new Map<string, number>();
  const maxTf = Math.max(...tf.values(), 1);

  for (const [term, count] of tf.entries()) {
    const normalizedTf = count / maxTf;
    const idf = idfScores.get(term) || 1;
    tfidf.set(term, normalizedTf * idf);
  }

  return tfidf;
}

function computeTfidfSimilarity(
  query: string,
  document: string,
  vocabulary: Map<string, number>,
  idfScores: Map<string, number>,
): number {
  const queryVec = computeTfidf(query, vocabulary, idfScores);
  const docVec = computeTfidf(document, vocabulary, idfScores);

  // Cosine similarity between TF-IDF vectors
  let dotProduct = 0;
  let queryMag = 0;
  let docMag = 0;

  for (const [term, qWeight] of queryVec.entries()) {
    const dWeight = docVec.get(term) || 0;
    dotProduct += qWeight * dWeight;
    queryMag += qWeight * qWeight;
  }

  for (const dWeight of docVec.values()) {
    docMag += dWeight * dWeight;
  }

  const magnitude = Math.sqrt(queryMag) * Math.sqrt(docMag);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

function computeTitleBoost(query: string, title: string): number {
  const queryTerms = tokenize(query);
  const titleTerms = tokenize(title);

  if (queryTerms.length === 0 || titleTerms.length === 0) return 0;

  // Exact match
  if (title.toLowerCase().includes(query.toLowerCase())) return 1.0;

  // Term overlap
  const matches = queryTerms.filter((qt) =>
    titleTerms.some((tt) => tt.includes(qt) || qt.includes(tt))
  ).length;

  return matches / queryTerms.length;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// ── Highlight Extraction ──

function extractHighlights(query: string, doc: SearchDocument): SearchHighlight[] {
  const highlights: SearchHighlight[] = [];
  const queryTerms = tokenize(query);

  for (const field of ['title', 'content'] as const) {
    const text = doc[field];
    const positions: [number, number][] = [];

    for (const term of queryTerms) {
      let idx = text.toLowerCase().indexOf(term);
      while (idx !== -1) {
        positions.push([idx, idx + term.length]);
        idx = text.toLowerCase().indexOf(term, idx + 1);
      }
    }

    if (positions.length > 0) {
      // Build snippet around first match
      const firstPos = positions[0][0];
      const snippetStart = Math.max(0, firstPos - 40);
      const snippetEnd = Math.min(text.length, firstPos + 120);
      const snippet = (snippetStart > 0 ? '...' : '') +
        text.substring(snippetStart, snippetEnd) +
        (snippetEnd < text.length ? '...' : '');

      highlights.push({ field, snippet, positions });
    }
  }

  return highlights;
}

// ── Merge Results ──

function mergeResults(primary: SearchResult[], secondary: SearchResult[]): SearchResult[] {
  const seen = new Set(primary.map((r) => r.document.id));
  const merged = [...primary];

  for (const result of secondary) {
    if (!seen.has(result.document.id)) {
      seen.add(result.document.id);
      merged.push(result);
    }
  }

  return merged.sort((a, b) => b.score - a.score);
}

// ── Stop Words ──

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
  'or', 'if', 'while', 'about', 'up', 'this', 'that', 'these', 'those',
  'it', 'its', 'he', 'she', 'they', 'we', 'you', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'our', 'their', 'what', 'which',
]);
