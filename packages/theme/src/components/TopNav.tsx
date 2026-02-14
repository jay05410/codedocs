import React from 'react';

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface TopNavProps {
  sections: NavSection[];
}

export function TopNav({ sections }: TopNavProps) {
  return (
    <nav className="codedocs-nav">
      <ul className="codedocs-nav-list">
        {sections.map((section) => (
          <li key={section.label} className="codedocs-nav-item">
            {/* If there's only one item and it's basically the section itself, or if we want a dropdown */}
            {section.items.length === 1 ? (
              <a 
                href={section.items[0].href} 
                className={`codedocs-nav-link ${section.items[0].active ? 'active' : ''}`}
              >
                {section.label}
              </a>
            ) : (
              <div className="codedocs-nav-dropdown-trigger">
                 <span className="codedocs-nav-link">{section.label}</span>
                 {/* Simple dropdown could be implemented here if needed */}
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
