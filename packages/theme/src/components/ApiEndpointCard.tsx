import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';

export interface ApiEndpointCardProps {
  method: string;
  path: string;
  handler: string;
  returnType: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    location?: string;
    description?: string;
  }[];
  description?: string;
  deprecated?: boolean;
  auth?: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--codedocs-method-get, #61affe)',
  POST: 'var(--codedocs-method-post, #49cc90)',
  PUT: 'var(--codedocs-method-put, #fca130)',
  DELETE: 'var(--codedocs-method-delete, #f93e3e)',
  PATCH: 'var(--codedocs-method-patch, #50e3c2)',
  Query: 'var(--codedocs-method-query, #61affe)',
  Mutation: 'var(--codedocs-method-mutation, #49cc90)',
  Subscription: 'var(--codedocs-method-subscription, #fca130)',
};

export function ApiEndpointCard({
  method,
  path,
  handler,
  returnType,
  parameters = [],
  description,
  deprecated,
  auth,
}: ApiEndpointCardProps) {
  const [open, setOpen] = useState(false);
  const { strings } = useI18n();
  const color = METHOD_COLORS[method] || '#999';

  return (
    <div className={`codedocs-api-card ${deprecated ? 'deprecated' : ''}`}>
      <button
        className="codedocs-api-card-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ borderLeftColor: color }}
      >
        <span className="codedocs-api-method" style={{ backgroundColor: color }}>
          {method}
        </span>
        <span className="codedocs-api-path">{path}</span>
        {auth && <span className="codedocs-api-auth" title={strings.theme.authRequired}>🔒</span>}
        {deprecated && <span className="codedocs-api-deprecated">{strings.theme.deprecated}</span>}
        <span className="codedocs-api-handler">{handler}</span>
      </button>
      {open && (
        <div className="codedocs-api-card-body">
          {description && <p className="codedocs-api-description">{description}</p>}
          <div className="codedocs-api-section">
            <span className="codedocs-api-label">{strings.theme.returns}</span>
            <code className="codedocs-api-type">{returnType}</code>
          </div>
          {parameters.length > 0 && (
            <div className="codedocs-api-section">
              <span className="codedocs-api-label">{strings.theme.parameters}</span>
              <table className="codedocs-api-params">
                <thead>
                  <tr>
                    <th>{strings.theme.name}</th>
                    <th>{strings.theme.type}</th>
                    <th>{strings.theme.required}</th>
                    <th>{strings.theme.location}</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.map((p) => (
                    <tr key={p.name}>
                      <td><code>{p.name}</code></td>
                      <td><code>{p.type}</code></td>
                      <td>{p.required ? 'Yes' : 'No'}</td>
                      <td>{p.location || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
