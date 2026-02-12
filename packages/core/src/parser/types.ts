// Source file representation
export interface SourceFile {
  path: string;
  content: string;
  language: string; // detected from extension
}

// Parser plugin interface
export interface ParserPlugin {
  name: string;
  filePattern: string | string[]; // glob patterns
  parse(files: SourceFile[]): ParseResult | Promise<ParseResult>;
}

// Parse result (what parsers return)
export interface ParseResult {
  endpoints?: EndpointInfo[];
  entities?: EntityInfo[];
  services?: ServiceInfo[];
  types?: TypeInfo[];
  dependencies?: DependencyInfo[];
  custom?: Record<string, unknown>;
}

// Unified endpoint (REST + GraphQL + gRPC + WebSocket)
export interface EndpointInfo {
  protocol: 'rest' | 'graphql' | 'grpc' | 'websocket' | 'custom';
  // REST fields
  httpMethod?: string;
  path?: string;
  // GraphQL fields
  operationType?: 'Query' | 'Mutation' | 'Subscription';
  fieldName?: string;
  // Common
  name: string;
  handler: string;
  handlerClass: string;
  parameters: ParameterInfo[];
  returnType: string;
  serviceRef?: string;
  filePath: string;
  description?: string;
  tags?: string[];
  auth?: boolean;
  deprecated?: boolean;
}

export interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
  location?: 'path' | 'query' | 'header' | 'body' | 'cookie';
}

export interface EntityInfo {
  name: string;
  tableName: string;
  dbType: string; // 'mysql' | 'postgresql' | 'mongodb' | 'dynamodb' | etc.
  columns: ColumnInfo[];
  relations: RelationInfo[];
  indexes: string[];
  filePath: string;
  description?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  dbColumnName: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue?: string;
  description?: string;
}

export interface RelationInfo {
  type: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
  target: string;
  joinColumn?: string;
  mappedBy?: string;
  eager?: boolean;
}

export interface ServiceInfo {
  name: string;
  filePath: string;
  methods: string[];
  dependencies: string[]; // injected services
  description?: string;
}

export interface TypeInfo {
  name: string;
  kind: 'dto' | 'input' | 'response' | 'enum' | 'interface' | 'type';
  fields: { name: string; type: string; required: boolean; description?: string }[];
  filePath: string;
  description?: string;
}

export interface DependencyInfo {
  source: string;
  target: string;
  type: 'import' | 'inject' | 'inherit' | 'implement' | 'use';
}

// Full analysis result
export interface AnalysisResult {
  metadata: {
    timestamp: string;
    sourceDir: string;
    parsers: string[];
    projectName: string;
    version: string;
  };
  summary: {
    totalFiles: number;
    endpoints: number;
    entities: number;
    services: number;
    types: number;
  };
  endpoints: EndpointInfo[];
  entities: EntityInfo[];
  services: ServiceInfo[];
  types: TypeInfo[];
  dependencies: DependencyInfo[];
  custom: Record<string, unknown>;
}
