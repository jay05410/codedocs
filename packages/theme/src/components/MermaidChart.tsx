import React, { useEffect, useRef, useState } from 'react';

export interface MermaidChartProps {
  code: string;
  title?: string;
}

export function MermaidChart({ code, title }: MermaidChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    // Mermaid renders asynchronously — check if global mermaid is available
    const renderChart = async () => {
      if (typeof window === 'undefined') return;
      const mermaid = (window as any).mermaid;
      if (!mermaid || !containerRef.current) return;
      try {
        const { svg } = await mermaid.render(
          `mermaid-${Math.random().toString(36).slice(2)}`,
          code,
        );
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="codedocs-mermaid-error">${code}</pre>`;
        }
      }
    };
    renderChart();
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="codedocs-mermaid-wrapper">
      {title && <div className="codedocs-mermaid-title">{title}</div>}
      <div className="codedocs-mermaid-toolbar">
        <button onClick={handleCopy} className="codedocs-mermaid-btn">
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button onClick={() => setZoomed(!zoomed)} className="codedocs-mermaid-btn">
          {zoomed ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div
        ref={containerRef}
        className={`codedocs-mermaid-container ${zoomed ? 'zoomed' : ''}`}
      />
    </div>
  );
}
