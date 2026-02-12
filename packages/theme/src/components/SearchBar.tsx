import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.js';

export interface SearchBarProps {
  className?: string;
}

declare global {
  interface Window {
    PagefindUI?: any;
  }
}

export function SearchBar({ className = '' }: SearchBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { strings } = useI18n();

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Load Pagefind UI dynamically
    const loadPagefind = async () => {
      if (window.PagefindUI) {
        new window.PagefindUI({
          element: containerRef.current,
          showSubResults: true,
          showImages: false,
        });
        return;
      }

      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/pagefind/pagefind-ui.css';
      document.head.appendChild(link);

      // Load JS
      const script = document.createElement('script');
      script.src = '/pagefind/pagefind-ui.js';
      script.onload = () => {
        if (window.PagefindUI && containerRef.current) {
          new window.PagefindUI({
            element: containerRef.current,
            showSubResults: true,
            showImages: false,
          });
        }
      };
      document.body.appendChild(script);
    };

    loadPagefind();
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        className={`codedocs-search-button ${className}`}
        onClick={handleToggle}
        aria-label={strings.common.search}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7.333 12.667A5.333 5.333 0 1 0 7.333 2a5.333 5.333 0 0 0 0 10.667ZM14 14l-2.9-2.9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="codedocs-search-text">
          {strings.common.search}
        </span>
      </button>

      {isOpen && (
        <div className="codedocs-search-modal" onClick={handleClose}>
          <div
            className="codedocs-search-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="codedocs-search-close"
              onClick={handleClose}
              aria-label="Close search"
            >
              ×
            </button>
            <div ref={containerRef} />
          </div>
        </div>
      )}
    </>
  );
}
