import { escapeHtml } from '@codedocs/core';

export function getRelativePrefix(slug: string): string {
  const depth = (slug.match(/\//g) || []).length;
  return depth === 0 ? './' : '../'.repeat(depth);
}

// ── Navigation / TOC types and helpers ──

export interface NavItem {
  label: string;
  href: string;
  active: boolean;
  children?: NavItem[];
}

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function buildTopNav(items: any[], basePrefix: string, currentSlug: string, s: any): NavItem[] {
  const navItems: NavItem[] = [];
  for (const item of items) {
    if (item.type === 'category' && item.items) {
      const firstChild = item.items[0];
      const isActive = item.items.some((child: any) => child.id === currentSlug);
      navItems.push({
        label: item.label,
        href: firstChild ? `${basePrefix}${firstChild.id}.html` : '#',
        active: isActive,
      });
    } else {
      navItems.push({
        label: item.label,
        href: `${basePrefix}${item.id}.html`,
        active: item.id === currentSlug,
      });
    }
  }
  // Add Memo nav item
  navItems.push({
    label: s.nav?.memo || 'Memo',
    href: `${basePrefix}memo.html`,
    active: currentSlug === 'memo',
  });
  return navItems;
}

export function addHeadingIds(html: string): string {
  const usedIds = new Set<string>();
  return html.replace(/<(h[23])>(.*?)<\/\1>/g, (_match, tag, text) => {
    const plainText = text.replace(/<[^>]+>/g, '').trim();
    let id = plainText
      .toLowerCase()
      .replace(/[^\w\s-\u3131-\uD79D]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    if (!id) id = 'heading';
    let uniqueId = id;
    let counter = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${id}-${counter++}`;
    }
    usedIds.add(uniqueId);
    return `<${tag} id="${uniqueId}">${text}</${tag}>`;
  });
}

export function extractTocHeadings(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const regex = /<(h[23])\s+id="([^"]*)">(.*?)<\/\1>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1].charAt(1));
    const id = match[2];
    const text = match[3].replace(/<[^>]+>/g, '').trim();
    headings.push({ id, text, level });
  }
  return headings;
}

export function buildNavHtml(navItems: NavItem[]): string {
  return navItems.map(item =>
    `<li class="top-nav-item"><a href="${item.href}" class="top-nav-link${item.active ? ' active' : ''}">${escapeHtml(item.label)}</a></li>`
  ).join('\n');
}

export function buildTocHtml(headings: TocHeading[], s: any): string {
  if (headings.length === 0) return '';
  const items = headings.map(h =>
    `<li class="toc-item toc-h${h.level}"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`
  ).join('\n');
  return `<aside class="toc-sidebar">
    <div class="toc-container">
      <div class="toc-title">${escapeHtml(s.toc.onThisPage)}</div>
      <ul class="toc-list">${items}</ul>
    </div>
  </aside>`;
}

export function buildLeftSidebar(sidebarStructure: any[], currentSlug: string, basePrefix: string, s: any): string {
  if (currentSlug === 'index' || currentSlug === 'memo') return '';

  // Find which section the current page belongs to
  var activeSection: any = null;
  for (var i = 0; i < sidebarStructure.length; i++) {
    var item = sidebarStructure[i];
    if (item.type === 'category' && item.items) {
      for (var j = 0; j < item.items.length; j++) {
        if (item.items[j].id === currentSlug) {
          activeSection = item;
          break;
        }
      }
      if (activeSection) break;
    } else if (item.id === currentSlug) {
      // Top-level doc item (overview, architecture) -- no sidebar needed
      return '';
    }
  }

  if (!activeSection || !activeSection.items) return '';

  var listItems = activeSection.items.map(function (child: any) {
    var isActive = child.id === currentSlug;
    return '<li class="left-sidebar-item' + (isActive ? ' active' : '') + '"><a href="' + basePrefix + child.id + '.html">' + escapeHtml(child.label) + '</a></li>';
  }).join('\n');

  return '<aside class="left-sidebar">\n  <div class="left-sidebar-container">\n    <div class="left-sidebar-title">' + escapeHtml(activeSection.label) + '</div>\n    <ul class="left-sidebar-list">\n' + listItems + '\n    </ul>\n  </div>\n</aside>';
}

export function buildBreadcrumb(sidebarStructure: any[], currentSlug: string, basePrefix: string, s: any): string {
  if (currentSlug === 'index') return '';
  if (currentSlug === 'memo') return '';

  var homeIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  var homeLink = '<a href="' + basePrefix + 'index.html" class="breadcrumb-item breadcrumb-home">' + homeIcon + '</a>';
  var sep = '<span class="breadcrumb-sep">/</span>';

  // Find which section the current page belongs to
  for (var i = 0; i < sidebarStructure.length; i++) {
    var item = sidebarStructure[i];
    if (item.type === 'category' && item.items) {
      for (var j = 0; j < item.items.length; j++) {
        if (item.items[j].id === currentSlug) {
          var firstChildHref = basePrefix + item.items[0].id + '.html';
          var sectionLink = '<a href="' + firstChildHref + '" class="breadcrumb-item">' + escapeHtml(item.label) + '</a>';
          var currentLabel = '<span class="breadcrumb-item breadcrumb-current">' + escapeHtml(item.items[j].label) + '</span>';
          return '<nav class="breadcrumb" aria-label="Breadcrumb">' + homeLink + sep + sectionLink + sep + currentLabel + '</nav>';
        }
      }
    } else if (item.id === currentSlug) {
      // Top-level doc (overview, architecture, changelog)
      var currentLabelTop = '<span class="breadcrumb-item breadcrumb-current">' + escapeHtml(item.label) + '</span>';
      return '<nav class="breadcrumb" aria-label="Breadcrumb">' + homeLink + sep + currentLabelTop + '</nav>';
    }
  }

  // Fallback: just show Home
  return '<nav class="breadcrumb" aria-label="Breadcrumb">' + homeLink + '</nav>';
}

export function getSectionIcon(label: string): string {
  var lower = label.toLowerCase();
  if (lower.includes('overview') || lower.includes('개요') || lower.includes('概要') || lower.includes('概述')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="11" rx="1"/><rect x="3" y="13" width="7" height="8" rx="1"/></svg>';
  }
  if (lower.includes('api') || lower.includes('endpoint')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
  }
  if (lower.includes('component') || lower.includes('컴포넌트') || lower.includes('组件')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l-2 7H3l6 4.5L7 21l5-3.5L17 21l-2-7.5L21 9h-7z"/></svg>';
  }
  if (lower.includes('hook') || lower.includes('service') || lower.includes('훅') || lower.includes('钩子')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  }
  if (lower.includes('architect') || lower.includes('아키텍처') || lower.includes('架构')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/></svg>';
  }
  if (lower.includes('changelog') || lower.includes('변경') || lower.includes('更新') || lower.includes('履歴')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  }
  if (lower.includes('memo') || lower.includes('메모') || lower.includes('备忘')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
  }
  if (lower.includes('data') || lower.includes('model') || lower.includes('entity') || lower.includes('엔티티') || lower.includes('实体')) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>';
  }
  // Default: document icon
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
}

export function getSectionDescription(label: string, s: any): string {
  var lower = label.toLowerCase();
  var desc = s.home?.sectionDesc || {};
  if (lower.includes('overview') || lower.includes('개요') || lower.includes('概要') || lower.includes('概述')) return desc.overview || 'Project summary, statistics, and quick links';
  if (lower.includes('api') || lower.includes('endpoint')) return desc.api || 'REST & GraphQL endpoint documentation';
  if (lower.includes('component') || lower.includes('컴포넌트') || lower.includes('组件')) return desc.components || 'UI component props and usage';
  if (lower.includes('hook') || lower.includes('service') || lower.includes('훅') || lower.includes('钩子')) return desc.hooks || 'Custom hooks and service layer';
  if (lower.includes('architect') || lower.includes('아키텍처') || lower.includes('架构')) return desc.architecture || 'Dependency graphs and system overview';
  if (lower.includes('changelog') || lower.includes('변경') || lower.includes('更新') || lower.includes('履歴')) return desc.changelog || 'Version history and changes';
  if (lower.includes('memo') || lower.includes('메모') || lower.includes('备忘')) return desc.memo || 'Team notes and annotations';
  if (lower.includes('data') || lower.includes('model') || lower.includes('entity')) return desc.api || 'Data model documentation';
  return '';
}

export function buildDashboardContent(sidebarStructure: any[], basePrefix: string, projectName: string, s: any): string {
  var cards = '';
  for (var i = 0; i < sidebarStructure.length; i++) {
    var item = sidebarStructure[i];
    var href: string;
    var label: string;
    if (item.type === 'category' && item.items && item.items.length > 0) {
      href = basePrefix + item.items[0].id + '.html';
      label = item.label;
    } else {
      href = basePrefix + item.id + '.html';
      label = item.label;
    }
    var icon = getSectionIcon(label);
    var description = getSectionDescription(label, s);
    cards += '<a href="' + href + '" class="dashboard-card"><div class="dashboard-card-icon">' + icon + '</div><div class="dashboard-card-info"><h3>' + escapeHtml(label) + '</h3><p>' + escapeHtml(description) + '</p></div></a>\n';
  }
  // Add Memo card
  var memoIcon = getSectionIcon('memo');
  var memoDesc = getSectionDescription('memo', s);
  var memoLabel = s.nav?.memo || 'Memo';
  cards += '<a href="' + basePrefix + 'memo.html" class="dashboard-card"><div class="dashboard-card-icon">' + memoIcon + '</div><div class="dashboard-card-info"><h3>' + escapeHtml(memoLabel) + '</h3><p>' + escapeHtml(memoDesc) + '</p></div></a>\n';

  var title = projectName;
  var subtitle = s.home?.subtitle || 'Explore your project documentation';

  return '<div class="dashboard"><div class="dashboard-header"><h1 class="dashboard-title">' + escapeHtml(title) + '</h1><p class="dashboard-subtitle">' + escapeHtml(subtitle) + '</p></div><div class="dashboard-grid">' + cards + '</div></div>';
}

export function buildMemoPageContent(s: any): string {
  var memoS = s.memoPage || {};
  var memoCommon = s.memo || {};
  var title = memoS.title || 'Memo Manager';
  var description = memoS.description || '';
  var exportLabel = memoCommon.exportAll || 'Export JSON';
  var copyLabel = memoS.copyJson || 'Copy JSON';
  var deleteAllLabel = memoS.deleteAll || 'Delete All';
  var filterAllLabel = memoS.filterAll || 'All';
  var importLabel = memoCommon.import || 'Import';
  var catImportant = memoCommon.important || 'Important';
  var catAdd = memoCommon.add || 'Add';
  var catModify = memoCommon.modify || 'Modify';
  var catDelete = memoCommon.delete || 'Delete';
  var catOther = memoCommon.other || 'Other';
  var totalCountTpl = memoS.totalCount || 'Total: {{n}} memos';
  var noMemos = memoS.noMemos || 'No memos yet. Add memos from any documentation page.';
  var confirmDeleteAll = memoS.confirmDeleteAll || 'Are you sure you want to delete all memos? This cannot be undone.';
  var copiedLabel = memoS.copied || 'Copied!';

  return '<div class="memo-page">' +
    '<div class="memo-page-header">' +
      '<h1>' + escapeHtml(title) + '</h1>' +
      '<p class="memo-page-desc">' + escapeHtml(description) + '</p>' +
    '</div>' +
    '<div class="memo-page-actions">' +
      '<button class="memo-page-action-btn" id="memoPageExport"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ' + escapeHtml(exportLabel) + '</button>' +
      '<button class="memo-page-action-btn" id="memoPageImport"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> ' + escapeHtml(importLabel) + '</button>' +
      '<input type="file" id="memoPageFileInput" accept=".json" style="display:none">' +
      '<button class="memo-page-action-btn" id="memoPageCopy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> ' + escapeHtml(copyLabel) + '</button>' +
      '<button class="memo-page-action-btn memo-page-danger-btn" id="memoPageDeleteAll"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> ' + escapeHtml(deleteAllLabel) + '</button>' +
    '</div>' +
    '<div class="memo-page-filters">' +
      '<button class="memo-page-filter-btn active" data-filter="all">' + escapeHtml(filterAllLabel) + '</button>' +
      '<button class="memo-page-filter-btn" data-filter="important">! ' + escapeHtml(catImportant) + '</button>' +
      '<button class="memo-page-filter-btn" data-filter="add">+ ' + escapeHtml(catAdd) + '</button>' +
      '<button class="memo-page-filter-btn" data-filter="modify">~ ' + escapeHtml(catModify) + '</button>' +
      '<button class="memo-page-filter-btn" data-filter="delete">- ' + escapeHtml(catDelete) + '</button>' +
      '<button class="memo-page-filter-btn" data-filter="other">? ' + escapeHtml(catOther) + '</button>' +
    '</div>' +
    '<div class="memo-page-count" id="memoPageCount"></div>' +
    '<div class="memo-page-list" id="memoPageList"></div>' +
  '</div>' +
  '<script>' +
  '(function() {' +
    'var STORAGE_KEY = "codedocs-memos";' +
    'var CATEGORIES = {important:"!",add:"+",modify:"~","delete":"-",other:"?"};' +
    'var currentFilter = "all";' +
    'var confirmMsg = ' + JSON.stringify(confirmDeleteAll) + ';' +
    'var copiedMsg = ' + JSON.stringify(copiedLabel) + ';' +
    'var totalTpl = ' + JSON.stringify(totalCountTpl) + ';' +
    'var noMemosMsg = ' + JSON.stringify(noMemos) + ';' +
    'function loadAll() { try { var s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : []; } catch(e) { return []; } }' +
    'function saveAll(m) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch(e) {} }' +
    'function formatTs(iso) { var d = new Date(iso); return d.toLocaleString(undefined, {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }' +
    'function render() {' +
      'var all = loadAll();' +
      'var filtered = currentFilter === "all" ? all : all.filter(function(m) { return m.category === currentFilter; });' +
      'filtered.sort(function(a,b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); });' +
      'var countEl = document.getElementById("memoPageCount");' +
      'countEl.textContent = totalTpl.replace("{{n}}", String(filtered.length));' +
      'var list = document.getElementById("memoPageList");' +
      'list.innerHTML = "";' +
      'if (filtered.length === 0) { list.innerHTML = "<div class=\\"memo-page-empty\\">" + noMemosMsg + "</div>"; return; }' +
      'for (var i = 0; i < filtered.length; i++) {' +
        '(function(memo) {' +
          'var item = document.createElement("div");' +
          'item.className = "memo-page-item";' +
          'item.style.borderLeft = "4px solid " + (memo.color || "#fff9c4");' +
          'var catIcon = CATEGORIES[memo.category] || "?";' +
          'item.innerHTML = "<span class=\\"memo-page-item-cat\\">" + catIcon + "</span>" +' +
            '"<div class=\\"memo-page-item-info\\">" +' +
              '"<div class=\\"memo-page-item-target\\">" + (memo.target || "(no target)") + "</div>" +' +
              '"<div class=\\"memo-page-item-content\\">" + ((memo.content || "").length > 100 ? (memo.content || "").slice(0,100) + "..." : (memo.content || "")) + "</div>" +' +
              '"<div class=\\"memo-page-item-meta\\">" + (memo.pageTitle || "") + " &middot; " + formatTs(memo.createdAt) + "</div>" +' +
            '"</div>";' +
          'item.addEventListener("click", function() { if (memo.pageUrl) window.location.href = memo.pageUrl; });' +
          'list.appendChild(item);' +
        '})(filtered[i]);' +
      '}' +
    '}' +
    // Filter buttons
    'var filterBtns = document.querySelectorAll(".memo-page-filter-btn");' +
    'filterBtns.forEach(function(btn) {' +
      'btn.addEventListener("click", function() {' +
        'filterBtns.forEach(function(b) { b.classList.remove("active"); });' +
        'btn.classList.add("active");' +
        'currentFilter = btn.getAttribute("data-filter");' +
        'render();' +
      '});' +
    '});' +
    // Export
    'document.getElementById("memoPageExport").addEventListener("click", function() {' +
      'var all = loadAll();' +
      'var blob = new Blob([JSON.stringify(all, null, 2)], {type:"application/json"});' +
      'var url = URL.createObjectURL(blob);' +
      'var a = document.createElement("a"); a.href = url; a.download = "memos.json"; a.click();' +
      'URL.revokeObjectURL(url);' +
    '});' +
    // Import
    'document.getElementById("memoPageImport").addEventListener("click", function() { document.getElementById("memoPageFileInput").click(); });' +
    'document.getElementById("memoPageFileInput").addEventListener("change", function(e) {' +
      'var file = e.target.files && e.target.files[0];' +
      'if (!file) return;' +
      'var reader = new FileReader();' +
      'reader.onload = function() {' +
        'try {' +
          'var imported = JSON.parse(reader.result);' +
          'if (!Array.isArray(imported)) return;' +
          'var existing = loadAll();' +
          'var ids = {};' +
          'for (var i = 0; i < existing.length; i++) ids[existing[i].id] = true;' +
          'var added = imported.filter(function(m) { return m.id && !ids[m.id]; });' +
          'if (added.length > 0) { saveAll(existing.concat(added)); render(); }' +
        '} catch(err) {}' +
      '};' +
      'reader.readAsText(file);' +
      'e.target.value = "";' +
    '});' +
    // Copy
    'document.getElementById("memoPageCopy").addEventListener("click", function() {' +
      'var all = loadAll();' +
      'var text = JSON.stringify(all, null, 2);' +
      'navigator.clipboard.writeText(text).then(function() {' +
        'var btn = document.getElementById("memoPageCopy");' +
        'var orig = btn.innerHTML;' +
        'btn.textContent = copiedMsg;' +
        'setTimeout(function() { btn.innerHTML = orig; }, 1500);' +
      '}).catch(function() {});' +
    '});' +
    // Delete All
    'document.getElementById("memoPageDeleteAll").addEventListener("click", function() {' +
      'if (confirm(confirmMsg)) { saveAll([]); render(); }' +
    '});' +
    'render();' +
  '})();' +
  '</script>';
}

export function decorateMermaidBlocks(html: string): string {
  return html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (match, attrs, inner) => {
    const block = `${attrs} ${inner}`.toLowerCase();
    if (!block.includes('mermaid')) return match;

    const decodedCode = inner
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (decodedCode.length === 0) return match;

    const encoded = Buffer.from(decodedCode, 'utf-8').toString('base64');
    return `<div class="mermaid-wrapper"><div class="mermaid-toolbar"><button class="mermaid-copy-btn" data-source="${encoded}" title="Copy code"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="mermaid-expand-btn" data-source="${encoded}" title="Expand"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button></div><div class="mermaid">${decodedCode}</div></div>`;
  });
}

export function sanitizeHtmlContent(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<(iframe|object|embed|applet|meta|base|form|input|button|textarea|select|link)\b[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|applet|meta|base|form|input|button|textarea|select|link)\b[^>]*\/?>/gi, '')
    .replace(/\s(on\w+)\s*=\s*(['"]).*?\2/gi, '')
    .replace(/\s(on\w+)\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src|xlink:href)\s*=\s*(['"])\s*(javascript:|vbscript:|data:(?!image\/))/gi, ' $1=$2#')
    .replace(/<a([^>]*?)target=(['"])_blank\2(?![^>]*rel=)([^>]*)>/gi, '<a$1target="_blank" rel="noopener noreferrer"$3>');
}

export function rewriteInternalLinks(html: string, knownSlugs: Set<string>): string {
  // Rewrite internal .md links to .html (skip external URLs)
  let result = html.replace(/href="([^"]*?)\.md(#[^"]*)?"/g, (match, path, hash) => {
    if (/^(https?:)?\/\//.test(path)) return match;
    return `href="${path}.html${hash || ''}"`;
  });
  // Rewrite directory links (./api/, ./entities/) to directory index.html
  result = result.replace(/href="(\.\/)([a-zA-Z0-9_-]+)\/"/g, (_match, prefix, dir) => {
    if (knownSlugs.has(`${dir}/index`)) {
      return `href="${prefix}${dir}/index.html"`;
    }
    // Fallback: link to first page in that directory
    for (const slug of knownSlugs) {
      if (slug.startsWith(`${dir}/`)) {
        return `href="${prefix}${slug}.html"`;
      }
    }
    return `href="${prefix}${dir}/index.html"`;
  });
  return result;
}

