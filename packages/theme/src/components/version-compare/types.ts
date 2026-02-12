// Version Comparison View types

export interface VersionCompareProps {
  comparison: VersionComparisonData;
  showUnchanged?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface VersionComparisonData {
  fromVersion: string;
  toVersion: string;
  summary: {
    totalChanges: number;
    added: number;
    removed: number;
    modified: number;
    breakingChanges: number;
  };
  endpoints: DiffItem[];
  entities: DiffItem[];
  types: DiffItem[];
  services: DiffItem[];
  breakingChanges: BreakingChangeItem[];
}

export interface DiffItem {
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  name: string;
  category: string;
  changes: DiffDetail[];
}

export interface DiffDetail {
  field: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  from?: string;
  to?: string;
}

export interface BreakingChangeItem {
  severity: 'critical' | 'warning';
  category: string;
  name: string;
  reason: string;
}
