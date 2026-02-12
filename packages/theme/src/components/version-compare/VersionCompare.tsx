import React, { useState } from 'react';
import type { VersionCompareProps, DiffItem, DiffDetail, BreakingChangeItem } from './types.js';
import './version-compare.css';

export function VersionCompare({
  comparison,
  showUnchanged = false,
  collapsible = true,
  defaultExpanded = true,
}: VersionCompareProps) {
  const { summary, breakingChanges } = comparison;

  return (
    <div className="codedocs-version-compare">
      {/* Header */}
      <div className="vc-header">
        <h2 className="vc-title">
          <span className="vc-version">{comparison.fromVersion}</span>
          <span className="vc-arrow">&rarr;</span>
          <span className="vc-version">{comparison.toVersion}</span>
        </h2>
        <div className="vc-badges">
          {summary.added > 0 && <span className="vc-badge vc-badge-added">+{summary.added} added</span>}
          {summary.removed > 0 && <span className="vc-badge vc-badge-removed">-{summary.removed} removed</span>}
          {summary.modified > 0 && <span className="vc-badge vc-badge-modified">~{summary.modified} modified</span>}
          {summary.breakingChanges > 0 && (
            <span className="vc-badge vc-badge-breaking">{summary.breakingChanges} breaking</span>
          )}
        </div>
      </div>

      {/* Breaking Changes */}
      {breakingChanges.length > 0 && (
        <BreakingChangesSection changes={breakingChanges} />
      )}

      {/* Sections */}
      <DiffSection
        title="Endpoints"
        items={comparison.endpoints}
        showUnchanged={showUnchanged}
        collapsible={collapsible}
        defaultExpanded={defaultExpanded}
      />
      <DiffSection
        title="Entities"
        items={comparison.entities}
        showUnchanged={showUnchanged}
        collapsible={collapsible}
        defaultExpanded={defaultExpanded}
      />
      <DiffSection
        title="Types"
        items={comparison.types}
        showUnchanged={showUnchanged}
        collapsible={collapsible}
        defaultExpanded={defaultExpanded}
      />
      <DiffSection
        title="Services"
        items={comparison.services}
        showUnchanged={showUnchanged}
        collapsible={collapsible}
        defaultExpanded={defaultExpanded}
      />
    </div>
  );
}

// ── Breaking Changes Section ──

function BreakingChangesSection({ changes }: { changes: BreakingChangeItem[] }) {
  return (
    <div className="vc-breaking">
      <h3 className="vc-breaking-title">Breaking Changes</h3>
      <div className="vc-breaking-list">
        {changes.map((change, i) => (
          <div key={i} className={`vc-breaking-item vc-severity-${change.severity}`}>
            <span className="vc-breaking-severity">
              {change.severity === 'critical' ? 'CRITICAL' : 'WARNING'}
            </span>
            <span className="vc-breaking-category">{change.category}</span>
            <span className="vc-breaking-name">{change.name}</span>
            <span className="vc-breaking-reason">{change.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Diff Section ──

function DiffSection({
  title,
  items,
  showUnchanged,
  collapsible,
  defaultExpanded,
}: {
  title: string;
  items: DiffItem[];
  showUnchanged: boolean;
  collapsible: boolean;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const filteredItems = showUnchanged ? items : items.filter((i) => i.status !== 'unchanged');

  if (filteredItems.length === 0) return null;

  const added = filteredItems.filter((i) => i.status === 'added').length;
  const removed = filteredItems.filter((i) => i.status === 'removed').length;
  const modified = filteredItems.filter((i) => i.status === 'modified').length;

  return (
    <div className="vc-section">
      <div
        className={`vc-section-header ${collapsible ? 'vc-clickable' : ''}`}
        onClick={() => collapsible && setExpanded(!expanded)}
      >
        <h3 className="vc-section-title">
          {collapsible && <span className={`vc-chevron ${expanded ? 'expanded' : ''}`}>{'\u25B6'}</span>}
          {title}
        </h3>
        <div className="vc-section-stats">
          {added > 0 && <span className="vc-stat vc-stat-added">+{added}</span>}
          {removed > 0 && <span className="vc-stat vc-stat-removed">-{removed}</span>}
          {modified > 0 && <span className="vc-stat vc-stat-modified">~{modified}</span>}
        </div>
      </div>

      {expanded && (
        <div className="vc-section-body">
          {filteredItems.map((item, i) => (
            <DiffItemRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Diff Item Row ──

function DiffItemRow({ item }: { item: DiffItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.changes.length > 0;

  return (
    <div className={`vc-item vc-item-${item.status}`}>
      <div className="vc-item-header" onClick={() => hasDetails && setExpanded(!expanded)}>
        <StatusBadge status={item.status} />
        <span className="vc-item-name">{item.name}</span>
        <span className="vc-item-category">{item.category}</span>
        {hasDetails && (
          <span className={`vc-item-chevron ${expanded ? 'expanded' : ''}`}>{'\u25B6'}</span>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="vc-item-details">
          <table className="vc-detail-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Field</th>
                <th>Previous</th>
                <th>Current</th>
              </tr>
            </thead>
            <tbody>
              {item.changes
                .filter((c) => c.status !== 'unchanged')
                .map((change, i) => (
                  <DiffDetailRow key={i} detail={change} />
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Detail Row ──

function DiffDetailRow({ detail }: { detail: DiffDetail }) {
  return (
    <tr className={`vc-detail-row vc-detail-${detail.status}`}>
      <td><StatusBadge status={detail.status} small /></td>
      <td className="vc-detail-field">{detail.field}</td>
      <td className="vc-detail-from">
        {detail.from ? <code>{detail.from}</code> : <span className="vc-empty">-</span>}
      </td>
      <td className="vc-detail-to">
        {detail.to ? <code>{detail.to}</code> : <span className="vc-empty">-</span>}
      </td>
    </tr>
  );
}

// ── Status Badge ──

function StatusBadge({ status, small }: { status: string; small?: boolean }) {
  const labels: Record<string, string> = {
    added: '+',
    removed: '-',
    modified: '~',
    unchanged: '=',
  };

  return (
    <span className={`vc-status vc-status-${status} ${small ? 'vc-status-sm' : ''}`}>
      {labels[status] || status}
    </span>
  );
}
