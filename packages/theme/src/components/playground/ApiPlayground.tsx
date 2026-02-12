import React, { useState, useCallback } from 'react';
import { useI18n } from '../../i18n/index.js';
import type {
  PlaygroundEndpoint,
  PlaygroundRequest,
  PlaygroundResponse,
  PlaygroundConfig,
} from './types.js';

export interface ApiPlaygroundProps {
  endpoint: PlaygroundEndpoint;
  config: PlaygroundConfig;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--codedocs-method-get)',
  POST: 'var(--codedocs-method-post)',
  PUT: 'var(--codedocs-method-put)',
  DELETE: 'var(--codedocs-method-delete)',
  PATCH: 'var(--codedocs-method-patch)',
};

export function ApiPlayground({ endpoint, config }: ApiPlaygroundProps) {
  const { strings } = useI18n();
  const [pathParams, setPathParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    endpoint.parameters
      .filter((p) => p.location === 'path')
      .forEach((p) => { initial[p.name] = p.defaultValue || ''; });
    return initial;
  });

  const [queryParams, setQueryParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    endpoint.parameters
      .filter((p) => p.location === 'query')
      .forEach((p) => { initial[p.name] = p.defaultValue || ''; });
    return initial;
  });

  const [headers, setHeaders] = useState<Record<string, string>>(() => ({
    ...config.defaultHeaders,
  }));

  const [body, setBody] = useState<string>(endpoint.requestBody?.example || '');
  const [authToken, setAuthToken] = useState('');
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');

  const buildUrl = useCallback(() => {
    const base = endpoint.baseUrl || config.baseUrl;
    let path = endpoint.path;

    // Replace path params
    for (const [key, value] of Object.entries(pathParams)) {
      path = path.replace(`{${key}}`, encodeURIComponent(value));
      path = path.replace(`:${key}`, encodeURIComponent(value));
    }

    const url = new URL(path, base);

    // Add query params
    for (const [key, value] of Object.entries(queryParams)) {
      if (value) url.searchParams.set(key, value);
    }

    return url.toString();
  }, [endpoint, config, pathParams, queryParams]);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    const url = buildUrl();
    const reqHeaders: Record<string, string> = { ...headers };

    // Auth
    if (authToken && endpoint.auth) {
      const prefix = endpoint.auth.tokenPrefix || 'Bearer';
      const headerName = endpoint.auth.headerName || 'Authorization';
      reqHeaders[headerName] = endpoint.auth.type === 'bearer'
        ? `${prefix} ${authToken}`
        : authToken;
    }

    // Content type for body
    if (body && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      reqHeaders['Content-Type'] = endpoint.requestBody?.contentType || 'application/json';
    }

    const startTime = performance.now();

    try {
      const fetchUrl = config.corsProxy ? `${config.corsProxy}${url}` : url;
      const res = await fetch(fetchUrl, {
        method: endpoint.method,
        headers: reqHeaders,
        body: ['POST', 'PUT', 'PATCH'].includes(endpoint.method) ? body || undefined : undefined,
      });

      const duration = Math.round(performance.now() - startTime);
      const resBody = await res.text();
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => { resHeaders[key] = value; });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        duration,
        size: new Blob([resBody]).size,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [buildUrl, headers, body, authToken, endpoint, config]);

  const methodColor = METHOD_COLORS[endpoint.method] || '#999';

  const pathParamList = endpoint.parameters.filter((p) => p.location === 'path');
  const queryParamList = endpoint.parameters.filter((p) => p.location === 'query');
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);

  return (
    <div className="codedocs-playground">
      {/* URL Bar */}
      <div className="playground-url-bar">
        <span className="playground-method" style={{ backgroundColor: methodColor }}>
          {endpoint.method}
        </span>
        <input
          className="playground-url-input"
          value={buildUrl()}
          readOnly
        />
        <button
          className="playground-send-btn"
          onClick={handleSend}
          disabled={loading}
        >
          {loading ? strings.theme.sending : strings.theme.send}
        </button>
      </div>

      {endpoint.description && (
        <p className="playground-description">{endpoint.description}</p>
      )}

      {/* Tabs */}
      <div className="playground-tabs">
        <button
          className={`playground-tab ${activeTab === 'params' ? 'active' : ''}`}
          onClick={() => setActiveTab('params')}
        >
          {strings.theme.parameters}
          {(pathParamList.length + queryParamList.length) > 0 && (
            <span className="playground-tab-badge">
              {pathParamList.length + queryParamList.length}
            </span>
          )}
        </button>
        <button
          className={`playground-tab ${activeTab === 'headers' ? 'active' : ''}`}
          onClick={() => setActiveTab('headers')}
        >
          {strings.theme.headers}
        </button>
        {hasBody && (
          <button
            className={`playground-tab ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            {strings.theme.body}
          </button>
        )}
        {endpoint.auth && (
          <button
            className={`playground-tab ${activeTab === 'auth' ? 'active' : ''}`}
            onClick={() => setActiveTab('auth')}
          >
            {strings.theme.auth}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="playground-tab-content">
        {activeTab === 'params' && (
          <div className="playground-params">
            {pathParamList.length > 0 && (
              <>
                <h4>{strings.theme.pathParameters}</h4>
                {pathParamList.map((p) => (
                  <ParamRow
                    key={p.name}
                    param={p}
                    value={pathParams[p.name] || ''}
                    onChange={(v) => setPathParams((prev) => ({ ...prev, [p.name]: v }))}
                  />
                ))}
              </>
            )}
            {queryParamList.length > 0 && (
              <>
                <h4>{strings.theme.queryParameters}</h4>
                {queryParamList.map((p) => (
                  <ParamRow
                    key={p.name}
                    param={p}
                    value={queryParams[p.name] || ''}
                    onChange={(v) => setQueryParams((prev) => ({ ...prev, [p.name]: v }))}
                  />
                ))}
              </>
            )}
            {pathParamList.length === 0 && queryParamList.length === 0 && (
              <p className="playground-empty">{strings.theme.noParameters}</p>
            )}
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="playground-headers">
            <KeyValueEditor
              entries={headers}
              onChange={setHeaders}
              placeholder={{ key: strings.theme.headerName, value: strings.theme.headerValue }}
            />
          </div>
        )}

        {activeTab === 'body' && hasBody && (
          <div className="playground-body">
            <textarea
              className="playground-body-editor"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"key": "value"}'
              rows={10}
              spellCheck={false}
            />
            {endpoint.requestBody?.fields && endpoint.requestBody.fields.length > 0 && (
              <div className="playground-body-fields">
                <h4>{strings.theme.fields}</h4>
                <table>
                  <thead>
                    <tr>
                      <th>{strings.theme.name}</th>
                      <th>{strings.theme.type}</th>
                      <th>{strings.theme.required}</th>
                      <th>{strings.theme.description}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.requestBody.fields.map((f) => (
                      <tr key={f.name}>
                        <td><code>{f.name}</code></td>
                        <td><code>{f.type}</code></td>
                        <td>{f.required ? 'Yes' : 'No'}</td>
                        <td>{f.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'auth' && endpoint.auth && (
          <div className="playground-auth">
            <label>
              {endpoint.auth.type === 'bearer' ? strings.theme.bearerToken :
               endpoint.auth.type === 'apiKey' ? strings.theme.apiKey :
               endpoint.auth.type === 'basic' ? strings.theme.basicAuth : strings.theme.token}
            </label>
            <input
              type="password"
              className="playground-auth-input"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={`Enter ${endpoint.auth.type} token`}
            />
          </div>
        )}
      </div>

      {/* Response */}
      {(response || error) && (
        <div className="playground-response">
          <div className="playground-response-header">
            <h4>{strings.theme.response}</h4>
            {response && (
              <div className="playground-response-meta">
                <StatusBadge status={response.status} />
                <span className="playground-response-time">{response.duration}ms</span>
                <span className="playground-response-size">{formatBytes(response.size)}</span>
              </div>
            )}
          </div>
          {error && <div className="playground-error">{error}</div>}
          {response && (
            <pre className="playground-response-body">
              <code>{formatResponseBody(response.body)}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function ParamRow({
  param,
  value,
  onChange,
}: {
  param: PlaygroundEndpoint['parameters'][0];
  value: string;
  onChange: (v: string) => void;
}) {
  const { strings } = useI18n();

  return (
    <div className="playground-param-row">
      <label>
        <code>{param.name}</code>
        {param.required && <span className="playground-required">*</span>}
        <span className="playground-param-type">{param.type}</span>
      </label>
      {param.enum ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{strings.theme.select}</option>
          {param.enum.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.description || param.name}
        />
      )}
    </div>
  );
}

function KeyValueEditor({
  entries,
  onChange,
  placeholder,
}: {
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  placeholder?: { key: string; value: string };
}) {
  const pairs = Object.entries(entries);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newKey) {
      onChange({ ...entries, [newKey]: newValue });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemove = (key: string) => {
    const next = { ...entries };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="playground-kv-editor">
      {pairs.map(([key, val]) => (
        <div key={key} className="playground-kv-row">
          <input value={key} readOnly className="playground-kv-key" />
          <input
            value={val}
            onChange={(e) => onChange({ ...entries, [key]: e.target.value })}
            className="playground-kv-value"
          />
          <button className="playground-kv-remove" onClick={() => handleRemove(key)}>x</button>
        </div>
      ))}
      <div className="playground-kv-row playground-kv-new">
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder={placeholder?.key || 'Key'}
          className="playground-kv-key"
        />
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder?.value || 'Value'}
          className="playground-kv-value"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="playground-kv-add" onClick={handleAdd}>+</button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const color = status < 300 ? '#49cc90' : status < 400 ? '#fca130' : '#f93e3e';
  return (
    <span className="playground-status" style={{ backgroundColor: color }}>
      {status}
    </span>
  );
}

// ── Helpers ──

function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
