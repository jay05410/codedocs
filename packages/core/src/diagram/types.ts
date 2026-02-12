export type DiagramType =
  | 'er'             // Entity-Relationship diagram
  | 'class'          // Class/type diagram
  | 'sequence'       // API call sequence diagram
  | 'flowchart'      // Service dependency flow
  | 'architecture'   // High-level architecture overview
  | 'api-flow'       // API request flow diagram
  | 'dependency';    // Module dependency graph

export interface DiagramOptions {
  /** Diagram type to generate */
  type: DiagramType;
  /** Chart direction: TB (top-bottom), LR (left-right) */
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Include entity relations */
  includeRelations?: boolean;
  /** Max number of nodes to display */
  maxNodes?: number;
  /** Group by package/module */
  groupByModule?: boolean;
  /** Filter by specific entity/service names */
  filter?: string[];
  /** Theme: default, dark, forest, neutral */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

export interface DiagramResult {
  type: DiagramType;
  code: string;
  title: string;
  nodeCount: number;
  edgeCount: number;
}
