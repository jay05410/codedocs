import type { AiProvider } from './types.js';
import type { EndpointInfo, EntityInfo, TypeInfo } from '../parser/types.js';
import type { Locale } from '../i18n/index.js';
import { getPrompt, fillTemplate } from './prompts/index.js';

export interface GeneratedExample {
  endpointName: string;
  request: RequestExample;
  response: ResponseExample;
}

export interface RequestExample {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  curl: string;
}

export interface ResponseExample {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface ExampleGeneratorOptions {
  locale?: Locale;
  baseUrl?: string;
  includeAuth?: boolean;
  maxExamples?: number;
}

/**
 * AI-powered request/response example generator
 * Uses LLM to generate realistic example data for API endpoints
 */
export class ExampleGenerator {
  constructor(
    private provider: AiProvider,
    private options: ExampleGeneratorOptions = {},
  ) {}

  /**
   * Generate examples for multiple endpoints
   */
  async generateAll(
    endpoints: EndpointInfo[],
    types: TypeInfo[],
    entities: EntityInfo[],
  ): Promise<GeneratedExample[]> {
    const max = this.options.maxExamples ?? endpoints.length;
    const selected = endpoints.slice(0, max);
    const examples: GeneratedExample[] = [];

    for (const endpoint of selected) {
      try {
        const example = await this.generateForEndpoint(endpoint, types, entities);
        examples.push(example);
      } catch {
        // Skip endpoints that fail to generate
        examples.push(this.buildFallbackExample(endpoint));
      }
    }

    return examples;
  }

  /**
   * Generate request/response example for a single endpoint
   */
  async generateForEndpoint(
    endpoint: EndpointInfo,
    types: TypeInfo[],
    entities: EntityInfo[],
  ): Promise<GeneratedExample> {
    const locale = this.options.locale || 'en';
    const baseUrl = this.options.baseUrl || 'https://api.example.com';

    // Build context about related types
    const relatedTypes = this.findRelatedTypes(endpoint, types, entities);

    const prompt = buildExamplePrompt(endpoint, relatedTypes, baseUrl, locale);

    const response = await this.provider.chat([
      { role: 'system', content: getSystemPrompt(locale) },
      { role: 'user', content: prompt },
    ], { temperature: 0.7, jsonMode: true });

    const parsed = JSON.parse(extractJson(response));

    return {
      endpointName: endpoint.name,
      request: {
        method: endpoint.httpMethod || 'GET',
        url: buildExampleUrl(endpoint, baseUrl, parsed.pathParams, parsed.queryParams),
        headers: {
          'Content-Type': 'application/json',
          ...(this.options.includeAuth ? { 'Authorization': 'Bearer <token>' } : {}),
          ...parsed.requestHeaders,
        },
        body: parsed.requestBody,
        curl: buildCurlCommand(endpoint, baseUrl, parsed),
      },
      response: {
        status: parsed.responseStatus || 200,
        statusText: parsed.responseStatusText || 'OK',
        headers: {
          'Content-Type': 'application/json',
          ...parsed.responseHeaders,
        },
        body: parsed.responseBody,
      },
    };
  }

  /**
   * Find types related to an endpoint (parameter types, return types)
   */
  private findRelatedTypes(
    endpoint: EndpointInfo,
    types: TypeInfo[],
    entities: EntityInfo[],
  ): string {
    const relatedNames = new Set<string>();

    // Collect type names from parameters
    for (const param of endpoint.parameters) {
      relatedNames.add(param.type);
    }
    relatedNames.add(endpoint.returnType);

    // Find matching types
    const matchedTypes = types.filter((t) =>
      relatedNames.has(t.name) || endpoint.returnType.includes(t.name)
    );

    // Find matching entities
    const matchedEntities = entities.filter((e) =>
      relatedNames.has(e.name) || endpoint.returnType.includes(e.name)
    );

    const parts: string[] = [];

    for (const t of matchedTypes) {
      const fields = t.fields.map((f) => `  ${f.name}: ${f.type}${f.required ? '' : '?'}`).join('\n');
      parts.push(`Type ${t.name} {\n${fields}\n}`);
    }

    for (const e of matchedEntities) {
      const cols = e.columns.map((c) => `  ${c.name}: ${c.type}${c.nullable ? '?' : ''}`).join('\n');
      parts.push(`Entity ${e.name} {\n${cols}\n}`);
    }

    return parts.join('\n\n') || 'No related types found.';
  }

  /**
   * Fallback example when AI generation fails
   */
  private buildFallbackExample(endpoint: EndpointInfo): GeneratedExample {
    const baseUrl = this.options.baseUrl || 'https://api.example.com';
    const path = endpoint.path || '/';

    return {
      endpointName: endpoint.name,
      request: {
        method: endpoint.httpMethod || 'GET',
        url: `${baseUrl}${path}`,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.httpMethod !== 'GET' ? {} : undefined,
        curl: `curl -X ${endpoint.httpMethod || 'GET'} "${baseUrl}${path}"`,
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: { message: 'Example response' },
      },
    };
  }
}

// ── Prompt Builders ──

function getSystemPrompt(locale: Locale): string {
  const prompts: Record<Locale, string> = {
    en: `You are an API documentation expert. Generate realistic request/response examples for API endpoints. Return valid JSON only.

Rules:
- Use realistic but fictional data (no real personal info)
- Match the parameter types and return types exactly
- Include appropriate HTTP status codes
- Generate curl commands that work
- Keep examples concise but complete`,
    ko: `당신은 API 문서 전문가입니다. API 엔드포인트에 대한 현실적인 요청/응답 예시를 생성하세요. 유효한 JSON만 반환하세요.

규칙:
- 현실적이지만 가상의 데이터 사용 (실제 개인정보 사용 금지)
- 파라미터 타입과 반환 타입을 정확히 매칭
- 적절한 HTTP 상태 코드 포함
- 실행 가능한 curl 명령어 생성
- 간결하지만 완전한 예시`,
    ja: `あなたはAPIドキュメントの専門家です。APIエンドポイントの現実的なリクエスト/レスポンス例を生成してください。有効なJSONのみを返してください。

ルール：
- 現実的だが架空のデータを使用
- パラメータ型と戻り値の型を正確にマッチ
- 適切なHTTPステータスコードを含める
- 動作するcurlコマンドを生成
- 簡潔だが完全な例`,
    zh: `你是API文档专家。为API端点生成现实的请求/响应示例。仅返回有效的JSON。

规则：
- 使用现实但虚构的数据
- 精确匹配参数类型和返回类型
- 包含适当的HTTP状态码
- 生成可执行的curl命令
- 简洁但完整的示例`,
  };

  return prompts[locale] || prompts.en;
}

function buildExamplePrompt(
  endpoint: EndpointInfo,
  relatedTypes: string,
  baseUrl: string,
  locale: Locale,
): string {
  const params = endpoint.parameters
    .map((p) => `  - ${p.name}: ${p.type} (${p.location || 'unknown'}, ${p.required ? 'required' : 'optional'})`)
    .join('\n');

  return `Generate a request/response example for this API endpoint:

Method: ${endpoint.httpMethod || endpoint.operationType || 'GET'}
Path: ${endpoint.path || endpoint.fieldName || '/'}
Base URL: ${baseUrl}
Handler: ${endpoint.handler}
Return Type: ${endpoint.returnType}
Auth Required: ${endpoint.auth ? 'Yes' : 'No'}

Parameters:
${params || '  None'}

Related Types:
${relatedTypes}

Return JSON with this exact structure:
{
  "pathParams": { "paramName": "exampleValue" },
  "queryParams": { "paramName": "exampleValue" },
  "requestHeaders": {},
  "requestBody": null or { ... },
  "responseStatus": 200,
  "responseStatusText": "OK",
  "responseHeaders": {},
  "responseBody": { ... }
}`;
}

// ── URL & Curl Builders ──

function buildExampleUrl(
  endpoint: EndpointInfo,
  baseUrl: string,
  pathParams?: Record<string, string>,
  queryParams?: Record<string, string>,
): string {
  let path = endpoint.path || '/';

  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      path = path.replace(`{${key}}`, value);
      path = path.replace(`:${key}`, value);
    }
  }

  let url = `${baseUrl}${path}`;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const qs = Object.entries(queryParams)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    url += `?${qs}`;
  }

  return url;
}

function buildCurlCommand(
  endpoint: EndpointInfo,
  baseUrl: string,
  parsed: Record<string, unknown>,
): string {
  const method = endpoint.httpMethod || 'GET';
  const url = buildExampleUrl(
    endpoint,
    baseUrl,
    parsed.pathParams as Record<string, string>,
    parsed.queryParams as Record<string, string>,
  );

  const parts = [`curl -X ${method}`];
  parts.push(`"${url}"`);
  parts.push('-H "Content-Type: application/json"');

  if (parsed.requestBody) {
    const body = JSON.stringify(parsed.requestBody);
    parts.push(`-d '${body}'`);
  }

  return parts.join(' \\\n  ');
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = fenceMatch ? fenceMatch[1] : text;
  const trimmed = jsonStr.trim();
  const start = trimmed.indexOf('{');
  if (start === -1) throw new Error('JSON not found');
  return trimmed.substring(start);
}

/**
 * Format a GeneratedExample as markdown for documentation
 */
export function formatExampleAsMarkdown(example: GeneratedExample): string {
  let md = '';

  md += `### Request\n\n`;
  md += '```http\n';
  md += `${example.request.method} ${example.request.url}\n`;
  for (const [key, value] of Object.entries(example.request.headers)) {
    md += `${key}: ${value}\n`;
  }
  if (example.request.body) {
    md += `\n${JSON.stringify(example.request.body, null, 2)}\n`;
  }
  md += '```\n\n';

  // Curl
  md += `#### cURL\n\n`;
  md += '```bash\n';
  md += `${example.request.curl}\n`;
  md += '```\n\n';

  // Response
  md += `### Response\n\n`;
  md += `**Status**: ${example.response.status} ${example.response.statusText}\n\n`;
  md += '```json\n';
  md += `${JSON.stringify(example.response.body, null, 2)}\n`;
  md += '```\n';

  return md;
}
