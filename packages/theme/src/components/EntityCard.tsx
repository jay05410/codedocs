import React, { useState } from 'react';

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
        <span className="codedocs-entity-count">{columns.length} columns</span>
      </button>
      {open && (
        <div className="codedocs-entity-body">
          <table className="codedocs-entity-columns">
            <thead>
              <tr>
                <th>Column</th>
                <th>Field</th>
                <th>Type</th>
                <th>Nullable</th>
                <th>PK</th>
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
              <h4>Relations</h4>
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
