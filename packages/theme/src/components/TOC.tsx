import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.js';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TOC() {
  const { strings } = useI18n();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const content = document.querySelector('.codedocs-content');
    if (!content) return;

    const elements = Array.from(content.querySelectorAll('h2, h3'));
    const extractedHeadings: Heading[] = elements.map((el) => {
      // Ensure element has an ID for linking
      if (!el.id) {
        el.id = el.textContent?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).substr(2, 9);
      }
      return {
        id: el.id,
        text: el.textContent || '',
        level: parseInt(el.tagName.charAt(1)),
      };
    });

    setHeadings(extractedHeadings);

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      { rootMargin: '-100px 0% -80% 0%' }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <aside className="codedocs-toc">
      <div className="codedocs-toc-title">On this page</div>
      <ul className="codedocs-toc-list">
        {headings.map((heading) => (
          <li 
            key={heading.id} 
            className={`codedocs-toc-item h${heading.level}`}
          >
            <a
              href={`#${heading.id}`}
              className={`codedocs-toc-link ${activeId === heading.id ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' });
                window.history.pushState(null, '', `#${heading.id}`);
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
