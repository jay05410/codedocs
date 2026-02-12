import type { ChangeEntry } from './differ.js';

export interface ReleaseNote {
  version: string;
  date: string;
  changes: ChangeEntry[];
  aiSummary?: string;
}

/**
 * Generate release note from change entries
 */
export async function generateReleaseNote(
  changes: ChangeEntry[],
  version: string,
  aiProvider?: AIProvider
): Promise<ReleaseNote> {
  const date = new Date().toISOString().split('T')[0];

  const releaseNote: ReleaseNote = {
    version,
    date,
    changes,
  };

  // Generate AI summary if provider is available
  if (aiProvider) {
    try {
      releaseNote.aiSummary = await generateAISummary(changes, aiProvider);
    } catch (error) {
      console.warn('Failed to generate AI summary:', error);
    }
  }

  return releaseNote;
}

/**
 * Format release note as markdown
 */
export function formatReleaseNote(releaseNote: ReleaseNote): string {
  let md = `## [${releaseNote.version}] - ${releaseNote.date}\n\n`;

  if (releaseNote.aiSummary) {
    md += `${releaseNote.aiSummary}\n\n`;
  }

  // Group changes by type and category
  const grouped = groupChanges(releaseNote.changes);

  // Added
  if (grouped.added.length > 0) {
    md += `### Added\n\n`;
    grouped.added.forEach(change => {
      md += formatChangeEntry(change);
    });
    md += '\n';
  }

  // Modified
  if (grouped.modified.length > 0) {
    md += `### Changed\n\n`;
    grouped.modified.forEach(change => {
      md += formatChangeEntry(change);
    });
    md += '\n';
  }

  // Removed
  if (grouped.removed.length > 0) {
    md += `### Removed\n\n`;
    grouped.removed.forEach(change => {
      md += formatChangeEntry(change);
    });
    md += '\n';
  }

  return md;
}

/**
 * Group changes by type
 */
function groupChanges(changes: ChangeEntry[]): {
  added: ChangeEntry[];
  modified: ChangeEntry[];
  removed: ChangeEntry[];
} {
  return {
    added: changes.filter(c => c.type === 'added'),
    modified: changes.filter(c => c.type === 'modified'),
    removed: changes.filter(c => c.type === 'removed'),
  };
}

/**
 * Format a single change entry as markdown
 */
function formatChangeEntry(change: ChangeEntry): string {
  const categoryLabel = change.category.charAt(0).toUpperCase() + change.category.slice(1);
  const detail = change.detail ? ` - ${change.detail}` : '';
  return `- **${categoryLabel}**: \`${change.name}\`${detail}\n`;
}

/**
 * Generate AI summary of changes
 */
async function generateAISummary(
  changes: ChangeEntry[],
  aiProvider: AIProvider
): Promise<string> {
  const prompt = buildSummaryPrompt(changes);
  const summary = await aiProvider.generateText(prompt);
  return summary.trim();
}

/**
 * Build prompt for AI summary generation
 */
function buildSummaryPrompt(changes: ChangeEntry[]): string {
  const changeList = changes
    .map(c => `- ${c.type.toUpperCase()}: ${c.category} "${c.name}" ${c.detail || ''}`)
    .join('\n');

  return `Summarize the following API changes in 2-3 sentences. Focus on the impact and key changes:

${changeList}

Summary:`;
}

/**
 * AI Provider interface (to be implemented by consumers)
 */
export interface AIProvider {
  generateText(prompt: string): Promise<string>;
}
