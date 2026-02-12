// API Playground types

export interface PlaygroundRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  pathParams: Record<string, string>;
  body?: string;
  contentType: 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain';
}

export interface PlaygroundResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number; // ms
  size: number;     // bytes
}

export interface PlaygroundEndpoint {
  method: string;
  path: string;
  baseUrl?: string;
  parameters: PlaygroundParam[];
  requestBody?: PlaygroundBodySchema;
  headers?: PlaygroundParam[];
  auth?: PlaygroundAuth;
  description?: string;
}

export interface PlaygroundParam {
  name: string;
  type: string;
  required: boolean;
  location: 'path' | 'query' | 'header' | 'cookie';
  defaultValue?: string;
  description?: string;
  enum?: string[];
}

export interface PlaygroundBodySchema {
  contentType: string;
  fields: PlaygroundBodyField[];
  example?: string;
}

export interface PlaygroundBodyField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface PlaygroundAuth {
  type: 'bearer' | 'apiKey' | 'basic' | 'oauth2';
  headerName?: string;  // for apiKey
  tokenPrefix?: string; // e.g., 'Bearer'
}

export interface PlaygroundConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  auth?: PlaygroundAuth;
  corsProxy?: string;  // proxy URL for CORS issues
}
