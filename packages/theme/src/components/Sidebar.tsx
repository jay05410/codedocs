import React, { useState } from 'react';

export interface SidebarSection {
  label: string;
  items: SidebarLink[];
}

export interface SidebarLink {
  label: string;
  href: string;
  active?: boolean;
}

export interface SidebarProps {
  sections: SidebarSection[];
}

export function Sidebar({ sections }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="codedocs-sidebar">
      <nav className="codedocs-sidebar-nav">
        {sections.map((section) => (
          <div key={section.label} className="codedocs-sidebar-section">
            <button
              className="codedocs-sidebar-heading"
              onClick={() => toggleSection(section.label)}
              aria-expanded={!collapsed[section.label]}
            >
              <span>{section.label}</span>
              <span className={`codedocs-sidebar-arrow ${collapsed[section.label] ? 'collapsed' : ''}`} />
            </button>
            {!collapsed[section.label] && (
              <ul className="codedocs-sidebar-list">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={`codedocs-sidebar-link ${item.active ? 'active' : ''}`}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
