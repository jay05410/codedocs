import React, { useState } from 'react';
import { useI18n } from '../i18n/index.js';

export interface NavItem {
  label: string;
  href?: string;
  active?: boolean;
  subItems?: NavItem[];
}

export interface TopNavigationProps {
  navItems: NavItem[];
}

export function TopNavigation({ navItems }: TopNavigationProps) {
  const { strings } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    setOpenDropdown(null); // Close any open dropdowns when toggling mobile menu
  };

  const toggleDropdown = (label: string) => {
    setOpenDropdown(openDropdown === label ? null : label);
  };

  return (
    <nav className="codedocs-top-nav">
      <button className="codedocs-top-nav-mobile-toggle" onClick={toggleMobileMenu} aria-label={strings.nav.toggleMenu}>
        <svg fill="currentColor" viewBox="0 0 20 20" className="codedocs-icon-menu">
          <path d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" fillRule="evenodd"></path>
        </svg>
      </button>

      <ul className={`codedocs-top-nav-list ${isMobileMenuOpen ? 'open' : ''}`}>
        {navItems.map((item) => (
          <li key={item.label} className="codedocs-top-nav-item">
            {item.subItems ? (
              <div className="codedocs-top-nav-dropdown">
                <button
                  className={`codedocs-top-nav-link codedocs-top-nav-dropdown-toggle ${item.active ? 'active' : ''}`}
                  onClick={() => toggleDropdown(item.label)}
                  aria-expanded={openDropdown === item.label}
                >
                  {item.label}
                  <span className={`codedocs-top-nav-arrow ${openDropdown === item.label ? 'open' : ''}`} />
                </button>
                {openDropdown === item.label && (
                  <ul className="codedocs-top-nav-dropdown-menu">
                    {item.subItems.map((subItem) => (
                      <li key={subItem.label}>
                        <a
                          href={subItem.href}
                          className={`codedocs-top-nav-dropdown-item ${subItem.active ? 'active' : ''}`}
                          onClick={() => setIsMobileMenuOpen(false)} // Close mobile menu on item click
                        >
                          {subItem.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <a
                href={item.href}
                className={`codedocs-top-nav-link ${item.active ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)} // Close mobile menu on item click
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
