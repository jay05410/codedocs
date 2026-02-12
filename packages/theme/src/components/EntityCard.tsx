import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';

export interface EntityCardProps {
  name: string;
  tableName: string;
  dbType: string;
  columns: {
    name: string;
    type: string;
    dbColumnName: string;
    nullable: boolean;
    primaryKey: boolean;
  }[];
  relations?: {
    type: string;
    target: string;
  }[];
}

export function EntityCard({ name, tableName, dbType, columns, relations = [] }: EntityCardProps) {
  const [open, setOpen] = useState(false);
  const { strings, t } = useI18n();

  return (
    <div className="codedocs-entity-card">
      <button
        className="codedocs-entity-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="codedocs-entity-name">{name}</span>
        <span className="codedocs-entity-table">
          <code>{tableName}</code>
        </span>
        <span className="codedocs-entity-badge">{dbType}</span>
        <span className="codedocs-entity-count">{t(strings.theme.nColumns, { n: columns.length })}</span>
      </button>
      {open && (
        <div className="codedocs-entity-body">
          <table className="codedocs-entity-columns">
            <thead>
              <tr>
                <th>{strings.theme.column}</th>
                <th>{strings.theme.field}</th>
                <th>{strings.theme.type}</th>
                <th>{strings.theme.nullable}</th>
                <th>{strings.theme.pk}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col.name}>
                  <td><code>{col.dbColumnName}</code></td>
                  <td><code>{col.name}</code></td>
                  <td><code>{col.type}</code></td>
                  <td>{col.nullable ? 'Yes' : 'No'}</td>
                  <td>{col.primaryKey ? '🔑' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {relations.length > 0 && (
            <div className="codedocs-entity-relations">
              <h4>{strings.theme.relations}</h4>
              <ul>
                {relations.map((rel, i) => (
                  <li key={i}>
                    <code>{rel.type}</code> → <code>{rel.target}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
