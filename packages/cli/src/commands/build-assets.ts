export interface RuntimeScriptOptions {
  pageId: string;
  currentSlug: string;
  title: string;
  s: any;
}

export function renderRuntimeScripts(opts: RuntimeScriptOptions): string {
  return `  <script>
    // Theme toggle
    function toggleTheme() {
      var html = document.documentElement;
      var current = html.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('codedocs-theme', next);
    }
    (function() {
      var saved = localStorage.getItem('codedocs-theme');
      if (saved) document.documentElement.setAttribute('data-theme', saved);
      else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();

    // Mobile menu toggle
    document.getElementById('mobileMenuToggle').addEventListener('click', function() {
      document.getElementById('topNav').classList.toggle('open');
    });

    // TOC scroll spy
    (function() {
      var tocLinks = document.querySelectorAll('.toc-item a');
      var headings = [];
      tocLinks.forEach(function(link) {
        var id = link.getAttribute('href');
        if (!id) return;
        var el = document.getElementById(id.slice(1));
        if (el) headings.push({ el: el, link: link });
      });
      if (headings.length === 0) return;
      function onScroll() {
        var scrollTop = window.scrollY + 100;
        var active = null;
        for (var i = headings.length - 1; i >= 0; i--) {
          if (headings[i].el.offsetTop <= scrollTop) {
            active = headings[i];
            break;
          }
        }
        tocLinks.forEach(function(l) { l.parentElement.classList.remove('active'); });
        if (active) active.link.parentElement.classList.add('active');
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    })();

    // Component/Service filter
    (function() {
      var filterInputs = document.querySelectorAll('.codedocs-filter-input');
      filterInputs.forEach(function(input) {
        input.addEventListener('input', function() {
          var query = input.value.toLowerCase();
          var container = input.closest('article') || document;
          var accordions = container.querySelectorAll('details.component-accordion, details.service-accordion');
          accordions.forEach(function(acc) {
            var name = (acc.getAttribute('data-component-name') || acc.querySelector('summary')?.textContent || '').toLowerCase();
            acc.style.display = name.includes(query) ? '' : 'none';
          });
        });
      });
    })();

    // Expand All / Collapse All
    (function() {
      document.querySelectorAll('.codedocs-expand-all-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var container = btn.closest('article') || document;
          container.querySelectorAll('details.component-accordion, details.service-accordion').forEach(function(d) {
            if (d.style.display !== 'none') d.open = true;
          });
        });
      });
      document.querySelectorAll('.codedocs-collapse-all-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var container = btn.closest('article') || document;
          container.querySelectorAll('details.component-accordion, details.service-accordion').forEach(function(d) {
            d.open = false;
          });
        });
      });
    })();

    // Hash-based accordion linking
    (function() {
      if (window.location.hash) {
        var target = document.getElementById(window.location.hash.slice(1));
        if (target) {
          var parentDetails = target.closest('details');
          if (parentDetails) parentDetails.open = true;
          setTimeout(function() { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        }
      }
      document.querySelectorAll('details.component-accordion, details.service-accordion').forEach(function(d) {
        d.addEventListener('toggle', function() {
          if (d.open && d.id) {
            history.replaceState(null, '', '#' + d.id);
          }
        });
      });
    })();

    // Left sidebar SPA navigation
    (function() {
      var leftSidebar = document.querySelector('.left-sidebar');
      if (!leftSidebar) return;

      leftSidebar.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//')) return;

        e.preventDefault();
        loadPage(href);
      });

      function loadPage(url) {
        fetch(url)
          .then(function(res) { return res.text(); })
          .then(function(html) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');

            // Extract new content
            var newContent = doc.querySelector('.content');
            if (!newContent) return;

            // Replace main content
            var currentContent = document.querySelector('.content');
            if (currentContent) {
              currentContent.innerHTML = newContent.innerHTML;
            }

            // Update active state in left sidebar
            var links = leftSidebar.querySelectorAll('.left-sidebar-item');
            links.forEach(function(item) {
              item.classList.remove('active');
              var a = item.querySelector('a');
              if (a && a.getAttribute('href') === url) {
                item.classList.add('active');
              }
            });

            // Update top nav active state
            var newTopNav = doc.querySelector('.top-nav');
            var currentTopNav = document.querySelector('.top-nav');
            if (newTopNav && currentTopNav) {
              currentTopNav.innerHTML = newTopNav.innerHTML;
            }

            // Rebuild TOC from new content
            rebuildToc();

            // Update breadcrumb
            var newBreadcrumb = doc.querySelector('.breadcrumb');
            var currentBreadcrumb = document.querySelector('.breadcrumb');
            if (newBreadcrumb && currentBreadcrumb) {
              currentBreadcrumb.outerHTML = newBreadcrumb.outerHTML;
            } else if (newBreadcrumb && !currentBreadcrumb) {
              var article = document.querySelector('.content article');
              if (article) article.insertAdjacentHTML('beforebegin', newBreadcrumb.outerHTML);
            }

            // Update URL
            history.pushState({ spaNav: true }, '', url);

            // Update page title
            var newTitle = doc.querySelector('title');
            if (newTitle) document.title = newTitle.textContent;

            // Scroll to top of content
            var main = document.querySelector('.content');
            if (main) main.scrollTop = 0;
            window.scrollTo(0, 0);

            // Re-init mermaid for new content
            if (window.mermaid) {
              var mermaidDivs = document.querySelectorAll('.content .mermaid:not([data-processed])');
              mermaidDivs.forEach(function(div) {
                try { window.mermaid.run({ nodes: [div] }); } catch(e) {}
              });
            }

            // Re-init runtime scripts for new content
            reinitContentScripts();
          })
          .catch(function(err) {
            // Fallback: do regular navigation
            window.location.href = url;
          });
      }

      function rebuildToc() {
        var tocSidebar = document.querySelector('.toc-sidebar');
        if (!tocSidebar) return;

        var content = document.querySelector('.content article');
        if (!content) return;

        var headings = content.querySelectorAll('h2[id], h3[id]');
        if (headings.length === 0) {
          tocSidebar.style.display = 'none';
          return;
        }
        tocSidebar.style.display = '';

        // Get the TOC title from existing element or use default
        var tocTitleEl = tocSidebar.querySelector('.toc-title');
        var tocTitle = tocTitleEl ? tocTitleEl.textContent : 'On this page';

        var items = '';
        headings.forEach(function(h) {
          var level = parseInt(h.tagName.charAt(1));
          items += '<li class="toc-item toc-h' + level + '"><a href="#' + h.id + '">' + h.textContent + '</a></li>';
        });

        tocSidebar.innerHTML = '<div class="toc-container"><div class="toc-title">' + tocTitle + '</div><ul class="toc-list">' + items + '</ul></div>';

        // Re-attach TOC scroll spy
        initTocScrollSpy();
      }

      function initTocScrollSpy() {
        var tocLinks = document.querySelectorAll('.toc-item a');
        var headings = [];
        tocLinks.forEach(function(link) {
          var id = link.getAttribute('href');
          if (!id) return;
          var el = document.getElementById(id.slice(1));
          if (el) headings.push({ el: el, link: link });
        });
        if (headings.length === 0) return;

        function onScroll() {
          var scrollTop = window.scrollY + 100;
          var active = null;
          for (var i = headings.length - 1; i >= 0; i--) {
            if (headings[i].el.offsetTop <= scrollTop) {
              active = headings[i];
              break;
            }
          }
          tocLinks.forEach(function(l) { l.parentElement.classList.remove('active'); });
          if (active) active.link.parentElement.classList.add('active');
        }

        // Remove old scroll listener, add new one
        window.removeEventListener('scroll', window._tocScrollHandler);
        window._tocScrollHandler = onScroll;
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }

      function reinitContentScripts() {
        // Re-attach accordion toggle handlers
        document.querySelectorAll('.content details.component-accordion, .content details.service-accordion').forEach(function(d) {
          d.addEventListener('toggle', function() {
            if (d.open && d.id) {
              history.replaceState(null, '', '#' + d.id);
            }
          });
        });

        // Re-attach filter inputs
        var filterInputs = document.querySelectorAll('.content .codedocs-filter-input');
        filterInputs.forEach(function(input) {
          input.addEventListener('input', function() {
            var query = input.value.toLowerCase();
            var container = input.closest('article') || document;
            var accordions = container.querySelectorAll('details.component-accordion, details.service-accordion');
            accordions.forEach(function(acc) {
              var name = (acc.getAttribute('data-component-name') || acc.querySelector('summary')?.textContent || '').toLowerCase();
              acc.style.display = name.includes(query) ? '' : 'none';
            });
          });
        });

        // Re-attach expand/collapse buttons
        document.querySelectorAll('.content .codedocs-expand-all-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var container = btn.closest('article') || document;
            container.querySelectorAll('details.component-accordion, details.service-accordion').forEach(function(d) {
              if (d.style.display !== 'none') d.open = true;
            });
          });
        });
        document.querySelectorAll('.content .codedocs-collapse-all-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var container = btn.closest('article') || document;
            container.querySelectorAll('details.component-accordion, details.service-accordion').forEach(function(d) {
              d.open = false;
            });
          });
        });

        // Re-init mermaid copy/expand buttons
        document.querySelectorAll('.content .mermaid-copy-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var src = btn.getAttribute('data-source');
            if (src) {
              var code = atob(src);
              navigator.clipboard.writeText(code);
            }
          });
        });
        document.querySelectorAll('.content .mermaid-expand-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var wrapper = btn.closest('.mermaid-wrapper');
            if (wrapper) {
              var container = wrapper.querySelector('.mermaid');
              if (container) container.classList.toggle('zoomed');
            }
          });
        });
      }

      // Handle browser back/forward
      window.addEventListener('popstate', function(e) {
        if (e.state && e.state.spaNav) {
          loadPage(window.location.href);
        } else {
          // For non-SPA history entries, do full reload
          window.location.reload();
        }
      });

      // Store initial state
      history.replaceState({ spaNav: true }, '', window.location.href);

      // Initialize TOC scroll spy tracking
      window._tocScrollHandler = null;
      initTocScrollSpy();
    })();

    // Global search
    (function() {
      var searchInput = document.getElementById('globalSearchInput');
      var searchResults = document.getElementById('searchResults');
      var searchResultsList = document.getElementById('searchResultsList');
      var searchEmpty = document.getElementById('searchEmpty');
      if (!searchInput || !searchResults) return;
      var searchIndex = null;
      var debounceTimer = null;

      // Keyboard shortcut: press / to focus search
      document.addEventListener('keydown', function(e) {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInput.focus();
        }
        if (e.key === 'Escape') {
          searchInput.blur();
          searchResults.style.display = 'none';
        }
      });

      function loadIndex() {
        if (searchIndex) return Promise.resolve(searchIndex);
        // Determine base path from the first stylesheet link
        var link = document.querySelector('link[rel="stylesheet"][href*="assets/style.css"]');
        var base = './';
        if (link) {
          var href = link.getAttribute('href');
          base = href.replace('assets/style.css', '');
        }
        return fetch(base + 'search-index.json').then(function(r) { return r.json(); }).then(function(data) {
          searchIndex = data;
          return data;
        }).catch(function() { return []; });
      }

      function highlight(text, query) {
        if (!query) return escapeText(text);
        var safe = escapeText(text);
        var escaped = query.replace(/[.*+?^\\$\\{\\}()|\\[\\]\\\\]/g, '\\\\' + '$&');
        var re = new RegExp('(' + escaped + ')', 'gi');
        return safe.replace(re, '<mark>$1</mark>');
      }
      function escapeText(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
      }

      function doSearch(query) {
        if (!query || query.length < 2) {
          searchResults.style.display = 'none';
          return;
        }
        loadIndex().then(function(index) {
          var q = query.toLowerCase();
          var results = [];
          for (var i = 0; i < index.length; i++) {
            var item = index[i];
            var score = 0;
            var titleLower = (item.title || '').toLowerCase();
            var textLower = (item.text || '').toLowerCase();
            if (titleLower.indexOf(q) !== -1) score += 10;
            if (textLower.indexOf(q) !== -1) score += 1;
            for (var h = 0; h < (item.headings || []).length; h++) {
              if ((item.headings[h] || '').toLowerCase().indexOf(q) !== -1) score += 5;
            }
            if (score > 0) results.push({ item: item, score: score });
          }
          results.sort(function(a, b) { return b.score - a.score; });
          results = results.slice(0, 8);

          searchResultsList.innerHTML = '';
          searchEmpty.style.display = results.length === 0 ? 'block' : 'none';
          searchResults.style.display = 'block';

          // Determine base path
          var link = document.querySelector('link[rel="stylesheet"][href*="assets/style.css"]');
          var base = './';
          if (link) {
            var href = link.getAttribute('href');
            base = href.replace('assets/style.css', '');
          }

          for (var j = 0; j < results.length; j++) {
            var r = results[j].item;
            var a = document.createElement('a');
            a.className = 'search-result-item';
            a.href = base + r.slug + '.html';
            var snippet = (r.text || '').slice(0, 120);
            a.innerHTML = '<div class="search-result-title">' + highlight(r.title || r.slug, query) + '</div>' +
              '<div class="search-result-snippet">' + highlight(snippet, query) + '</div>';
            searchResultsList.appendChild(a);
          }
        });
      }

      searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          doSearch(searchInput.value.trim());
        }, 200);
      });
      searchInput.addEventListener('focus', function() {
        if (searchInput.value.trim().length >= 2) {
          doSearch(searchInput.value.trim());
        }
      });
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.header-search')) {
          searchResults.style.display = 'none';
        }
      });
    })();
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script>
    hljs.highlightAll();
    var observer = new MutationObserver(function() {
      document.querySelectorAll('link[href*="highlight"]').forEach(function(link) {
        if (link.media.includes('light')) {
          link.media = document.documentElement.dataset.theme === 'dark' ? 'not all' : 'all';
        } else {
          link.media = document.documentElement.dataset.theme === 'dark' ? 'all' : 'not all';
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Mermaid copy buttons
    document.querySelectorAll('.mermaid-copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var src = atob(btn.dataset.source);
        navigator.clipboard.writeText(src).then(function() {
          var orig = btn.innerHTML;
          btn.innerHTML = '<span class="mermaid-copied">Copied!</span>';
          btn.classList.add('copied');
          setTimeout(function() { btn.innerHTML = orig; btn.classList.remove('copied'); }, 1500);
        }).catch(function() {});
      });
    });

    // Mermaid expand buttons
    document.querySelectorAll('.mermaid-expand-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var wrapper = btn.closest('.mermaid-wrapper');
        var svgEl = wrapper.querySelector('.mermaid svg');
        if (!svgEl) return;
        var svgMarkup = svgEl.outerHTML;
        var overlay = document.createElement('div');
        overlay.className = 'mermaid-overlay';
        var BASE_SCALE = 5;
        var zoom = 100;
        overlay.innerHTML =
          '<div class="mermaid-popup">' +
            '<div class="mermaid-popup-header">' +
              '<div class="mermaid-zoom-controls">' +
                '<button class="mermaid-zoom-btn" data-action="out">-</button>' +
                '<span class="mermaid-zoom-level">' + zoom + '%</span>' +
                '<button class="mermaid-zoom-btn" data-action="in">+</button>' +
              '</div>' +
              '<button class="mermaid-close-btn" title="Close">' +
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="mermaid-popup-body">' +
              '<div class="mermaid-popup-content" style="transform:scale(' + BASE_SCALE + ')">' + svgMarkup + '</div>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
        requestAnimationFrame(function() { overlay.classList.add('active'); });
        var content = overlay.querySelector('.mermaid-popup-content');
        var levelEl = overlay.querySelector('.mermaid-zoom-level');
        var popupSvg = content.querySelector('svg');
        if (popupSvg) { popupSvg.style.maxWidth = 'none'; popupSvg.style.maxHeight = 'none'; }
        overlay.querySelector('[data-action="in"]').addEventListener('click', function() {
          zoom = Math.min(zoom + 10, 500);
          content.style.transform = 'scale(' + (BASE_SCALE * zoom / 100) + ')';
          levelEl.textContent = zoom + '%';
        });
        overlay.querySelector('[data-action="out"]').addEventListener('click', function() {
          zoom = Math.max(zoom - 10, 10);
          content.style.transform = 'scale(' + (BASE_SCALE * zoom / 100) + ')';
          levelEl.textContent = zoom + '%';
        });
        var closePopup = function() {
          overlay.classList.remove('active');
          setTimeout(function() { overlay.remove(); }, 200);
        };
        overlay.querySelector('.mermaid-close-btn').addEventListener('click', closePopup);
        overlay.addEventListener('click', function(ev) { if (ev.target === overlay) closePopup(); });
        document.addEventListener('keydown', function esc(ev) {
          if (ev.key === 'Escape') { closePopup(); document.removeEventListener('keydown', esc); }
        });
      });
    });
  </script>
  <script>
    // Memo System - Sticky Notes (i18n)
    (function() {
      var PAGE_ID = ${JSON.stringify(opts.pageId)};
      var PAGE_URL = ${JSON.stringify(opts.currentSlug + '.html')};
      var PAGE_TITLE = ${JSON.stringify(opts.title)};
      var STORAGE_KEY = 'codedocs-memos';
      var STRINGS = ${JSON.stringify(opts.s.memo)};
      var COLORS = ['#fff9c4','#c8e6c9','#bbdefb','#f8bbd0','#ffe0b2','#e1bee7','#b2dfdb'];
      var CATEGORIES = {important:'!',add:'+',modify:'~','delete':'-',other:'?'};
      var CAT_NAMES = {important:STRINGS.important,add:STRINGS.add,modify:STRINGS.modify,'delete':STRINGS['delete'],other:STRINGS.other};
      var memosVisible = true;

      var stickyContainer = document.getElementById('memoStickyContainer');
      var toggleBtn = document.getElementById('memoToggleBtn');
      if (!toggleBtn) return; // Memo page has its own UI; skip floating controls
      var badge = document.getElementById('memoBadge');
      var visibilityBtn = document.getElementById('memoVisibilityBtn');
      var panel = document.getElementById('memoPanel');
      var closeBtn = document.getElementById('memoCloseBtn');
      var memoList = document.getElementById('memoList');
      var exportBtn = document.getElementById('memoExportBtn');
      var fileInput = document.getElementById('memoFileInput');
      var contextMenu = document.getElementById('memoContextMenu');
      var contextAdd = document.getElementById('memoContextAdd');
      var filterToggle = document.getElementById('memoFilterToggle');
      var panelCopyBtn = document.getElementById('memoPanelCopy');
      var currentPageOnly = true;
      var contextX = 0;
      var contextY = 0;

      function loadAllMemos() {
        try {
          var stored = localStorage.getItem(STORAGE_KEY);
          if (!stored) return [];
          var parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed : [];
        } catch(e) { return []; }
      }
      function saveAllMemos(memos) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memos)); } catch(e) {
          if (e.name === 'QuotaExceededError') { alert(STRINGS.exportAll + ' - Storage full'); }
        }
      }
      function getPageMemos() {
        return loadAllMemos().filter(function(m) { return m.docId === PAGE_ID; });
      }
      function formatTimestamp(iso) {
        var d = new Date(iso);
        return d.toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      }
      function updateBadge() {
        var count = getPageMemos().length;
        if (count > 0) { badge.textContent = count; badge.style.display = 'flex'; }
        else { badge.style.display = 'none'; }
      }
      function getCatIcon(cat) { return CATEGORIES[cat] || '?'; }

      // --- Sticky Note DOM ---
      function createStickyEl(memo) {
        var note = document.createElement('div');
        note.className = 'codedocs-sticky' + (memo.minimized ? ' minimized' : '');
        note.setAttribute('data-memo-id', memo.id);
        note.style.left = memo.x + 'px';
        note.style.top = memo.y + 'px';
        note.style.width = (memo.width || 280) + 'px';
        note.style.backgroundColor = memo.color || COLORS[0];
        if (!memo.minimized) {
          note.style.height = (memo.height || 200) + 'px';
        }

        // Header
        var header = document.createElement('div');
        header.className = 'codedocs-sticky-header';
        header.style.backgroundColor = memo.color || COLORS[0];

        var catSelect = document.createElement('select');
        catSelect.className = 'codedocs-sticky-cat-select';
        var catKeys = Object.keys(CATEGORIES);
        for (var ci = 0; ci < catKeys.length; ci++) {
          var opt = document.createElement('option');
          opt.value = catKeys[ci];
          opt.textContent = CATEGORIES[catKeys[ci]] + ' ' + (CAT_NAMES[catKeys[ci]] || catKeys[ci]);
          if (catKeys[ci] === memo.category) opt.selected = true;
          catSelect.appendChild(opt);
        }
        catSelect.addEventListener('change', function() {
          updateMemoField(memo.id, 'category', catSelect.value);
        });
        header.appendChild(catSelect);

        var headerBtns = document.createElement('div');
        headerBtns.className = 'codedocs-sticky-header-btns';

        var minBtn = document.createElement('button');
        minBtn.className = 'codedocs-sticky-btn';
        minBtn.innerHTML = '&#8211;';
        minBtn.title = STRINGS.minimize;
        minBtn.addEventListener('click', function(ev) {
          ev.stopPropagation();
          toggleMinimize(memo.id);
        });

        var closeNoteBtn = document.createElement('button');
        closeNoteBtn.className = 'codedocs-sticky-btn';
        closeNoteBtn.innerHTML = '&times;';
        closeNoteBtn.title = STRINGS.deleteMemo;
        closeNoteBtn.addEventListener('click', function(ev) {
          ev.stopPropagation();
          deleteMemo(memo.id);
        });

        headerBtns.appendChild(minBtn);
        headerBtns.appendChild(closeNoteBtn);
        header.appendChild(headerBtns);
        note.appendChild(header);

        if (memo.minimized) {
          // Minimized: show just category icon tag
          var minTag = document.createElement('div');
          minTag.className = 'codedocs-sticky-min-tag';
          minTag.textContent = getCatIcon(memo.category);
          minTag.addEventListener('click', function() { toggleMinimize(memo.id); });
          note.innerHTML = '';
          note.appendChild(minTag);
          return note;
        }

        // Target field
        var targetInput = document.createElement('input');
        targetInput.className = 'codedocs-sticky-target';
        targetInput.type = 'text';
        targetInput.placeholder = STRINGS.target;
        targetInput.value = memo.target || '';
        targetInput.addEventListener('change', function() {
          updateMemoField(memo.id, 'target', targetInput.value);
        });
        targetInput.addEventListener('keydown', function(ev) {
          if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { commitNote(memo.id); }
        });
        note.appendChild(targetInput);

        // Content textarea
        var contentArea = document.createElement('textarea');
        contentArea.className = 'codedocs-sticky-content';
        contentArea.placeholder = STRINGS.placeholder;
        contentArea.value = memo.content || '';
        contentArea.title = STRINGS.finishEditing;
        contentArea.addEventListener('change', function() {
          updateMemoField(memo.id, 'content', contentArea.value);
        });
        contentArea.addEventListener('keydown', function(ev) {
          if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { commitNote(memo.id); }
        });
        note.appendChild(contentArea);

        // Color bar
        var colorBar = document.createElement('div');
        colorBar.className = 'codedocs-sticky-colors';
        for (var i = 0; i < COLORS.length; i++) {
          (function(c) {
            var circle = document.createElement('span');
            circle.className = 'codedocs-sticky-color-circle' + (c === (memo.color || COLORS[0]) ? ' active' : '');
            circle.style.backgroundColor = c;
            circle.addEventListener('click', function() {
              updateMemoField(memo.id, 'color', c);
              renderStickies();
            });
            colorBar.appendChild(circle);
          })(COLORS[i]);
        }
        note.appendChild(colorBar);

        // Drag
        makeDraggable(note, header, memo.id);
        // Resize
        makeResizable(note, memo.id);

        return note;
      }

      function makeDraggable(el, handle, memoId) {
        var startX, startY, origX, origY;
        handle.addEventListener('mousedown', function(ev) {
          if (ev.target.tagName === 'SELECT' || ev.target.tagName === 'BUTTON') return;
          ev.preventDefault();
          startX = ev.clientX;
          startY = ev.clientY;
          origX = parseInt(el.style.left, 10) || 0;
          origY = parseInt(el.style.top, 10) || 0;
          function onMove(e) {
            var dx = e.clientX - startX;
            var dy = e.clientY - startY;
            el.style.left = (origX + dx) + 'px';
            el.style.top = (origY + dy) + 'px';
          }
          function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            updateMemoField(memoId, 'x', parseInt(el.style.left, 10));
            updateMemoField(memoId, 'y', parseInt(el.style.top, 10));
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      }

      function makeResizable(el, memoId) {
        var resizeHandle = document.createElement('div');
        resizeHandle.className = 'codedocs-sticky-resize';
        el.appendChild(resizeHandle);
        var startX, startY, startW, startH;
        resizeHandle.addEventListener('mousedown', function(ev) {
          ev.preventDefault();
          ev.stopPropagation();
          startX = ev.clientX;
          startY = ev.clientY;
          startW = el.offsetWidth;
          startH = el.offsetHeight;
          function onMove(e) {
            var nw = startW + (e.clientX - startX);
            var nh = startH + (e.clientY - startY);
            if (nw > 180) el.style.width = nw + 'px';
            if (nh > 120) el.style.height = nh + 'px';
          }
          function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            updateMemoField(memoId, 'width', el.offsetWidth);
            updateMemoField(memoId, 'height', el.offsetHeight);
          }
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
      }

      // --- Data operations ---
      function createMemo(x, y, target) {
        var memo = {
          id: 'memo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11),
          docId: PAGE_ID,
          pageUrl: PAGE_URL,
          pageTitle: PAGE_TITLE,
          content: '',
          category: 'other',
          target: target || '',
          createdAt: new Date().toISOString(),
          x: x,
          y: y,
          color: COLORS[0],
          minimized: false,
          width: 280,
          height: 200
        };
        var all = loadAllMemos();
        all.push(memo);
        saveAllMemos(all);
        renderStickies();
        updateBadge();
        renderPanelList();
        return memo;
      }

      function updateMemoField(id, field, value) {
        var all = loadAllMemos();
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === id) { all[i][field] = value; break; }
        }
        saveAllMemos(all);
        updateBadge();
      }

      function toggleMinimize(id) {
        var all = loadAllMemos();
        for (var i = 0; i < all.length; i++) {
          if (all[i].id === id) { all[i].minimized = !all[i].minimized; break; }
        }
        saveAllMemos(all);
        renderStickies();
      }

      function commitNote(id) {
        // Blur active element to save, then re-render
        if (document.activeElement) document.activeElement.blur();
        renderStickies();
      }

      function deleteMemo(id) {
        var all = loadAllMemos().filter(function(m) { return m.id !== id; });
        saveAllMemos(all);
        renderStickies();
        updateBadge();
        renderPanelList();
      }

      // --- Render sticky notes on page ---
      function renderStickies() {
        stickyContainer.innerHTML = '';
        if (!memosVisible) return;
        var pageMemos = getPageMemos();
        for (var i = 0; i < pageMemos.length; i++) {
          stickyContainer.appendChild(createStickyEl(pageMemos[i]));
        }
      }

      // --- Panel list ---
      function renderPanelList() {
        var memos;
        if (currentPageOnly) {
          memos = getPageMemos();
        } else {
          memos = loadAllMemos();
        }
        memos.sort(function(a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); });
        memoList.innerHTML = '';
        if (memos.length === 0) {
          memoList.innerHTML = '<div class="codedocs-memo-empty">' + STRINGS.noMemos + '</div>';
          return;
        }
        for (var i = 0; i < memos.length; i++) {
          (function(memo) {
            var item = document.createElement('div');
            item.className = 'codedocs-memo-item';
            item.style.borderLeft = '4px solid ' + (memo.color || COLORS[0]);

            var catSpan = document.createElement('span');
            catSpan.className = 'codedocs-memo-cat-icon';
            catSpan.textContent = getCatIcon(memo.category);

            var info = document.createElement('div');
            info.className = 'codedocs-memo-item-info';

            var targetEl = document.createElement('div');
            targetEl.className = 'codedocs-memo-item-target';
            targetEl.textContent = memo.target || '(' + STRINGS.target + ')';

            var contentEl = document.createElement('div');
            contentEl.className = 'codedocs-memo-item-content';
            var truncated = (memo.content || '').length > 60 ? (memo.content || '').slice(0, 60) + '...' : (memo.content || STRINGS.noMemos);
            contentEl.textContent = truncated;

            var metaEl = document.createElement('div');
            metaEl.className = 'codedocs-memo-item-meta';
            metaEl.textContent = (memo.pageTitle || '') + ' - ' + formatTimestamp(memo.createdAt);

            info.appendChild(targetEl);
            info.appendChild(contentEl);
            info.appendChild(metaEl);

            item.appendChild(catSpan);
            item.appendChild(info);

            item.addEventListener('click', function() {
              if (memo.docId !== PAGE_ID) {
                // Navigate to the page
                window.location.href = memo.pageUrl;
                return;
              }
              // Scroll to memo position
              window.scrollTo({ top: Math.max(0, memo.y - 100), behavior: 'smooth' });
              // Ensure visible
              if (!memosVisible) {
                memosVisible = true;
                renderStickies();
              }
            });

            memoList.appendChild(item);
          })(memos[i]);
        }
      }

      // --- Export / Import ---
      function exportAllMemos() {
        var all = loadAllMemos();
        var blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = 'memos.json'; a.click();
        URL.revokeObjectURL(url);
      }
      function importMemos(file) {
        var reader = new FileReader();
        reader.onload = function() {
          try {
            var imported = JSON.parse(reader.result);
            if (!Array.isArray(imported)) return;
            var existing = loadAllMemos();
            var existingIds = {};
            for (var i = 0; i < existing.length; i++) { existingIds[existing[i].id] = true; }
            var added = imported.filter(function(m) { return m.id && !existingIds[m.id]; });
            if (added.length > 0) {
              saveAllMemos(existing.concat(added));
              renderStickies();
              updateBadge();
              renderPanelList();
            }
          } catch(e) {}
        };
        reader.readAsText(file);
      }

      // --- Event bindings ---
      toggleBtn.addEventListener('click', function() {
        var isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) renderPanelList();
      });
      closeBtn.addEventListener('click', function() { panel.style.display = 'none'; });

      visibilityBtn.addEventListener('click', function() {
        memosVisible = !memosVisible;
        visibilityBtn.classList.toggle('off', !memosVisible);
        renderStickies();
      });

      filterToggle.addEventListener('click', function() {
        currentPageOnly = !currentPageOnly;
        filterToggle.classList.toggle('active', currentPageOnly);
        renderPanelList();
      });

      exportBtn.addEventListener('click', exportAllMemos);
      panelCopyBtn.addEventListener('click', function() {
        var all = loadAllMemos();
        var text = JSON.stringify(all, null, 2);
        navigator.clipboard.writeText(text).then(function() {
          var orig = panelCopyBtn.innerHTML;
          panelCopyBtn.innerHTML = '<span style="font-size:0.7rem">' + (STRINGS.copied || 'Copied!') + '</span>';
          setTimeout(function() { panelCopyBtn.innerHTML = orig; }, 1500);
        }).catch(function() {});
      });
      if (fileInput) {
        fileInput.addEventListener('change', function(e) {
          var file = e.target.files && e.target.files[0];
          if (file) importMemos(file);
          e.target.value = '';
        });
      }

      // Context menu on article area
      var article = document.querySelector('article');
      if (article) {
        article.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          contextX = e.pageX;
          contextY = e.pageY;
          contextMenu.style.display = 'block';
          contextMenu.style.left = e.pageX + 'px';
          contextMenu.style.top = e.pageY + 'px';
        });
      }
      contextAdd.addEventListener('click', function() {
        contextMenu.style.display = 'none';
        var sel = (window.getSelection() || '').toString().trim();
        var memo = createMemo(contextX, contextY, sel);
      });
      document.addEventListener('click', function(e) {
        if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          contextMenu.style.display = 'none';
          if (panel.style.display !== 'none') panel.style.display = 'none';
        }
      });

      // Init
      updateBadge();
      renderStickies();
    })();
  </script>`;
}

export function getStylesheet(): string {
  return `
:root, [data-theme="light"] {
  --bg: #ffffff;
  --bg-secondary: #f8f9fb;
  --bg-tertiary: #f0f2f5;
  --text: #1a1a2e;
  --text-secondary: #57606a;
  --text-muted: #8b949e;
  --border: #dce1e8;
  --border-light: #e8ecf2;
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --primary-light: #eef2ff;
  --primary-subtle: #f5f7ff;
  --code-bg: #f6f8fa;
  --header-bg: #ffffff;
  --shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --radius: 8px;
  --radius-lg: 12px;
}
[data-theme="dark"] {
  --bg: #0f1117;
  --bg-secondary: #181b24;
  --bg-tertiary: #1e222d;
  --text: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;
  --border: #2d3347;
  --border-light: #232838;
  --primary: #818cf8;
  --primary-hover: #a5b4fc;
  --primary-light: #1e1b4b;
  --primary-subtle: #171533;
  --code-bg: #161b22;
  --header-bg: #181b24;
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4);
  --radius: 8px;
  --radius-lg: 12px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
  color: var(--text);
  background: var(--bg);
  line-height: 1.7;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Header ── */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}
.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.logo {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
  letter-spacing: -0.02em;
  white-space: nowrap;
  flex-shrink: 0;
}
.logo:hover { color: var(--primary); }
.header-actions {
  margin-left: auto;
  flex-shrink: 0;
}
.theme-toggle {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 8px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  transition: all 0.15s;
}
.theme-toggle:hover { color: var(--text); border-color: var(--text-muted); }
[data-theme="light"] .moon-icon { display: none; }
[data-theme="dark"] .sun-icon { display: none; }

/* ── Top Navigation ── */
.top-nav {
  flex: 1;
  min-width: 0;
}
.top-nav-list {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.top-nav-list::-webkit-scrollbar { display: none; }
.top-nav-item {
  position: relative;
  flex-shrink: 0;
}
.top-nav-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 6px;
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s, background 0.12s;
  font-family: inherit;
}
.top-nav-link:hover {
  color: var(--text);
  background: var(--bg-tertiary);
}
.top-nav-link.active {
  color: var(--primary);
  font-weight: 600;
  position: relative;
}
.top-nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -17px;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--primary);
  border-radius: 1px;
}

/* ── Mobile hamburger ── */
.mobile-menu-toggle {
  display: none;
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.mobile-menu-toggle:hover { color: var(--text); border-color: var(--text-muted); }

/* ── Layout (3-column grid) ── */
.layout {
  display: grid;
  grid-template-columns: 250px 1fr 220px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 60px);
}
.layout-full {
  grid-template-columns: 1fr;
}
.layout-single {
  grid-template-columns: 1fr;
}
.layout-no-left {
  grid-template-columns: 1fr 220px;
}
.layout-no-toc {
  grid-template-columns: 250px 1fr;
}
.content {
  padding: 2rem 3rem;
  min-width: 0;
}

/* ── Left Sidebar ── */
.left-sidebar {
  width: 250px;
  padding: 1.5rem 1rem;
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  overflow-y: auto;
  border-right: 1px solid var(--border-light);
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.left-sidebar::-webkit-scrollbar { width: 4px; }
.left-sidebar::-webkit-scrollbar-track { background: transparent; }
.left-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.left-sidebar-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
  padding: 0 0.5rem;
}
.left-sidebar-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.left-sidebar-item a {
  display: block;
  padding: 6px 12px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 6px;
  transition: color 0.12s, background 0.12s;
}
.left-sidebar-item a:hover {
  color: var(--text);
  background: var(--bg-tertiary);
}
.left-sidebar-item.active a {
  color: var(--primary);
  font-weight: 600;
  background: var(--primary-subtle);
}

/* ── Breadcrumb ── */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0.75rem 0;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.breadcrumb-item { color: var(--text-secondary); text-decoration: none; }
.breadcrumb-item:hover { color: var(--primary); }
.breadcrumb-home { display: flex; align-items: center; }
.breadcrumb-current { color: var(--text); font-weight: 500; }
.breadcrumb-sep { color: var(--text-muted); font-size: 0.75rem; }

/* ── TOC Sidebar ── */
.toc-sidebar {
  width: 220px;
  min-width: 220px;
  padding: 2rem 1rem 2rem 0;
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
  flex-shrink: 0;
}
.toc-sidebar::-webkit-scrollbar { width: 4px; }
.toc-sidebar::-webkit-scrollbar-track { background: transparent; }
.toc-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.toc-container {
  border-left: 1px solid var(--border-light);
  padding-left: 1rem;
}
.toc-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}
.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.toc-item {
  margin: 0;
}
.toc-item a {
  display: block;
  padding: 3px 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-decoration: none;
  line-height: 1.5;
  transition: color 0.12s;
}
.toc-item a:hover { color: var(--text); }
.toc-item.active a {
  color: var(--primary);
  font-weight: 600;
}
.toc-h3 { padding-left: 0.75rem; }

/* ── Dashboard ── */
.dashboard { padding: 3rem 2rem; max-width: 900px; margin: 0 auto; }
.dashboard-header { position: relative; text-align: center; margin-bottom: 3rem; }
.dashboard-header::before {
  content: '';
  position: absolute;
  top: -3rem;
  left: -2rem;
  right: -2rem;
  bottom: -1rem;
  background: linear-gradient(135deg, var(--primary-subtle) 0%, transparent 60%);
  border-radius: var(--radius-lg);
  z-index: -1;
}
.dashboard-title { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.02em; }
.dashboard-subtitle { color: var(--text-secondary); font-size: 1.1rem; margin-top: 0.5rem; }
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
}
.dashboard-stat {
  text-align: center;
}
.dashboard-stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.2;
}
.dashboard-stat-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}
.dashboard-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.dashboard-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
}
.dashboard-card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  background: var(--primary-subtle);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dashboard-card-icon svg { width: 24px; height: 24px; }
.dashboard-card-info h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.dashboard-card-info p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

/* ── Memo Page ── */
.memo-page { padding: 2rem; max-width: 900px; margin: 0 auto; }
.memo-page-header { margin-bottom: 1.5rem; }
.memo-page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }
.memo-page-desc { color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; }
.memo-page-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.memo-page-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.memo-page-action-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary);
  color: var(--text);
}
.memo-page-danger-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
}
.memo-page-filters {
  display: flex;
  gap: 6px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.memo-page-filter-btn {
  padding: 6px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.memo-page-filter-btn:hover { border-color: var(--primary); color: var(--text); }
.memo-page-filter-btn.active {
  background: var(--primary-subtle);
  color: var(--primary);
  border-color: var(--primary);
}
.memo-page-count {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}
.memo-page-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.memo-page-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 3rem 0;
}
.memo-page-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.15s;
}
.memo-page-item:hover { background: var(--bg-tertiary); }
.memo-page-item-cat {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-secondary);
  flex-shrink: 0;
  background: var(--bg);
  border-radius: 6px;
}
.memo-page-item-info { flex: 1; min-width: 0; }
.memo-page-item-target {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.memo-page-item-content {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.memo-page-item-meta {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 4px;
}

/* ── Article ── */
article h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
  letter-spacing: -0.02em;
  line-height: 1.3;
}
article h2 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 2.5rem 0 0.75rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid var(--border-light);
  letter-spacing: -0.01em;
  line-height: 1.4;
}
article h3 { font-size: 1.15rem; font-weight: 600; margin: 1.75rem 0 0.5rem; line-height: 1.4; }
article p { margin: 0.75rem 0; line-height: 1.75; }
article ul, article ol { margin: 0.75rem 0; padding-left: 1.75rem; }
article li { margin: 0.35rem 0; line-height: 1.65; }
article li::marker { color: var(--text-muted); }
article a { color: var(--primary); text-decoration: none; font-weight: 500; }
article a:hover { text-decoration: underline; color: var(--primary-hover); }
article table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.25rem 0;
  font-size: 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
article th {
  background: var(--bg-secondary);
  font-weight: 600;
  text-align: left;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-secondary);
}
article td {
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid var(--border-light);
}
article tr:last-child td { border-bottom: none; }
article tr:hover { background: var(--bg-secondary); }
article code {
  background: var(--code-bg);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  border: 1px solid var(--border-light);
}
article pre {
  background: var(--code-bg);
  padding: 1rem 1.25rem;
  border-radius: var(--radius);
  overflow-x: auto;
  margin: 1.25rem 0;
  border: 1px solid var(--border);
}
article pre code {
  background: none;
  padding: 0;
  font-size: 0.85rem;
  line-height: 1.65;
  border: none;
}
article blockquote {
  border-left: 3px solid var(--primary);
  padding: 0.75rem 1.25rem;
  margin: 1.25rem 0;
  background: var(--primary-subtle);
  border-radius: 0 var(--radius) var(--radius) 0;
  color: var(--text-secondary);
}
article details {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
}
article summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 0.9rem;
}
article summary:hover { color: var(--text); }
article hr { border: none; border-top: 1px solid var(--border-light); margin: 2rem 0; }
article strong { font-weight: 600; }

/* ── Swagger-style Accordion ── */
article details.component-accordion,
article details.service-accordion {
  margin: 0.75rem 0;
  padding: 0;
  background: var(--bg);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  overflow: hidden;
}
article details.component-accordion summary,
article details.service-accordion summary {
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.15s;
  border-radius: 0;
}
article details.component-accordion summary:hover,
article details.service-accordion summary:hover {
  background: var(--bg-tertiary);
}
article details.component-accordion[open] summary,
article details.service-accordion[open] summary {
  border-bottom: 1px solid var(--border);
  border-radius: 0;
}
article details.component-accordion > :not(summary),
article details.service-accordion > :not(summary) {
  padding: 1rem;
}
.accordion-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--primary-subtle);
  color: var(--primary);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: auto;
}
.accordion-source-path {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 0.5rem 0.75rem;
  background: var(--code-bg);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
  display: block;
  margin-top: 0.5rem;
}
.component-section-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

/* ── Mermaid wrapper ── */
.mermaid-wrapper {
  position: relative;
  margin: 1.5rem 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  background: var(--bg-secondary);
}
.mermaid-wrapper:hover .mermaid-toolbar { opacity: 1; }
.mermaid { text-align: center; }
.mermaid svg { max-width: 100%; height: auto; }
.mermaid-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 10;
}
.mermaid-copy-btn, .mermaid-expand-btn {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 7px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
  font-size: 0.75rem;
}
.mermaid-copy-btn:hover, .mermaid-expand-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text);
  border-color: var(--text-muted);
}
.mermaid-copy-btn.copied {
  background: var(--primary-subtle);
  color: var(--primary);
  border-color: var(--primary);
}
.mermaid-copied { font-size: 0.75rem; font-weight: 600; padding: 0 2px; }

/* ── Mermaid popup overlay ── */
.mermaid-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.mermaid-overlay.active { opacity: 1; }
.mermaid-popup {
  background: var(--bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  width: 90vw;
  height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mermaid-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.mermaid-zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mermaid-zoom-btn {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: var(--text);
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}
.mermaid-zoom-btn:hover { background: var(--bg-tertiary); border-color: var(--text-muted); }
.mermaid-zoom-level {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 48px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.mermaid-close-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  transition: all 0.12s;
}
.mermaid-close-btn:hover { color: var(--text); background: var(--bg-tertiary); }
.mermaid-popup-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.mermaid-popup-content {
  transform-origin: center center;
  transition: transform 0.15s ease;
}
.mermaid-popup-content svg { max-width: none; max-height: none; }

/* ── Footer ── */
.footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
  color: var(--text-muted);
  font-size: 0.8rem;
}
.footer a { color: var(--text-secondary); text-decoration: none; }
.footer a:hover { color: var(--primary); }

/* ── Memo Controls (bottom-right) ── */
.codedocs-memo-controls {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 100;
}
.codedocs-memo-visibility-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, opacity 0.2s;
}
.codedocs-memo-visibility-btn:hover { transform: scale(1.1); }
.codedocs-memo-visibility-btn.off { opacity: 0.4; }
.codedocs-memo-button {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
}
.codedocs-memo-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}
.codedocs-memo-button:active { transform: scale(0.95); }
.codedocs-memo-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border: 2px solid var(--bg);
}

/* ── Sticky Note ── */
.codedocs-sticky {
  position: absolute;
  min-width: 180px;
  min-height: 120px;
  border-radius: 4px;
  box-shadow: 2px 2px 10px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  z-index: 50;
  font-size: 0.85rem;
  overflow: hidden;
}
.codedocs-sticky.minimized {
  min-width: auto;
  min-height: auto;
  width: 36px !important;
  height: 36px !important;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
}
.codedocs-sticky-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  cursor: move;
  gap: 4px;
  filter: brightness(0.92);
  flex-shrink: 0;
}
.codedocs-sticky-cat-select {
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  padding: 2px;
  max-width: 120px;
}
.codedocs-sticky-cat-select:focus { outline: none; }
.codedocs-sticky-header-btns {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.codedocs-sticky-btn {
  background: transparent;
  border: none;
  font-size: 1rem;
  color: #555;
  cursor: pointer;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  line-height: 1;
}
.codedocs-sticky-btn:hover { background: rgba(0,0,0,0.1); }
.codedocs-sticky-target {
  border: none;
  border-bottom: 1px dashed rgba(0,0,0,0.2);
  background: transparent;
  padding: 4px 8px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #333;
  flex-shrink: 0;
}
.codedocs-sticky-target:focus { outline: none; border-bottom-color: rgba(0,0,0,0.5); }
.codedocs-sticky-target::placeholder { color: rgba(0,0,0,0.35); }
.codedocs-sticky-content {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 0.8rem;
  color: #333;
  resize: none;
  line-height: 1.5;
}
.codedocs-sticky-content:focus { outline: none; }
.codedocs-sticky-content::placeholder { color: rgba(0,0,0,0.35); }
.codedocs-sticky-colors {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  flex-shrink: 0;
}
.codedocs-sticky-color-circle {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
  box-shadow: 0 0 2px rgba(0,0,0,0.15);
}
.codedocs-sticky-color-circle:hover { transform: scale(1.2); }
.codedocs-sticky-color-circle.active { border-color: #333; }
.codedocs-sticky-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.15) 50%);
}
.codedocs-sticky-min-tag {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  color: #333;
  cursor: pointer;
}

/* ── Memo Manager Panel (floating above button) ── */
.codedocs-memo-panel {
  position: fixed;
  bottom: 96px;
  right: 24px;
  width: 380px;
  max-width: 90vw;
  max-height: 60vh;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  z-index: 200;
  animation: memoSlideUp 0.3s ease-out;
}
@keyframes memoSlideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.codedocs-memo-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.codedocs-memo-panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  flex-shrink: 0;
}
.codedocs-memo-panel-actions {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: flex-end;
}
.codedocs-memo-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  position: relative;
}
.codedocs-memo-icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text);
  border-color: var(--primary);
}
/* ── Memo icon button tooltip ── */
.codedocs-memo-icon-btn[title]:hover::after {
  content: attr(title);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
.codedocs-memo-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.2s;
  flex-shrink: 0;
  margin-left: 4px;
}
.codedocs-memo-close:hover {
  background: var(--bg-tertiary);
  color: var(--text);
}
.codedocs-memo-panel-filters {
  display: flex;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.codedocs-memo-toggle-btn {
  padding: 6px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.codedocs-memo-toggle-btn.active {
  background: var(--primary-subtle);
  color: var(--primary);
  border-color: var(--primary);
}
.codedocs-memo-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.codedocs-memo-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  padding: 1.5rem 0;
}
.codedocs-memo-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.codedocs-memo-item:hover { background: var(--bg-tertiary); }
.codedocs-memo-cat-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-secondary);
  flex-shrink: 0;
  background: var(--bg);
  border-radius: 4px;
}
.codedocs-memo-item-info {
  flex: 1;
  min-width: 0;
}
.codedocs-memo-item-target {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.codedocs-memo-item-content {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.codedocs-memo-item-meta {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ── Context Menu ── */
.codedocs-context-menu {
  position: absolute;
  z-index: 9999;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  min-width: 160px;
  padding: 4px 0;
}
.codedocs-context-menu-item {
  padding: 8px 16px;
  font-size: 0.875rem;
  color: var(--text);
  cursor: pointer;
  transition: background 0.12s;
}
.codedocs-context-menu-item:hover {
  background: var(--primary-subtle);
  color: var(--primary);
}

/* ── Dark mode shadows ── */
[data-theme="dark"] .codedocs-memo-button {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
[data-theme="dark"] .codedocs-memo-button:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}
[data-theme="dark"] .codedocs-memo-panel {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}
[data-theme="dark"] .codedocs-context-menu {
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
}
[data-theme="dark"] .codedocs-sticky-cat-select,
[data-theme="dark"] .codedocs-sticky-target,
[data-theme="dark"] .codedocs-sticky-content,
[data-theme="dark"] .codedocs-sticky-btn,
[data-theme="dark"] .codedocs-sticky-min-tag {
  color: #222;
}
[data-theme="dark"] .codedocs-sticky-target::placeholder,
[data-theme="dark"] .codedocs-sticky-content::placeholder {
  color: rgba(0,0,0,0.4);
}
[data-theme="dark"] .codedocs-memo-visibility-btn {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* ── Filter bar and controls ── */
.codedocs-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 1rem 0 1.5rem;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.codedocs-filter-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.codedocs-filter-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}
.codedocs-filter-input::placeholder { color: var(--text-muted); }
.codedocs-filter-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.codedocs-expand-all-btn,
.codedocs-collapse-all-btn {
  padding: 6px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.codedocs-expand-all-btn:hover,
.codedocs-collapse-all-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary);
  color: var(--text);
}

/* ── Type badges ── */
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.type-badge-hook, .badge-hook { background: #f3e8ff; color: #7c3aed; }
.type-badge-component, .badge-component { background: #dbeafe; color: #2563eb; }
.type-badge-service, .badge-service { background: #dcfce7; color: #16a34a; }
.type-badge-provider, .badge-provider { background: #fef3c7; color: #d97706; }
.type-badge-layout, .badge-layout { background: #fce7f3; color: #db2777; }
[data-theme="dark"] .type-badge-hook, [data-theme="dark"] .badge-hook { background: #2e1065; color: #c4b5fd; }
[data-theme="dark"] .type-badge-component, [data-theme="dark"] .badge-component { background: #172554; color: #93c5fd; }
[data-theme="dark"] .type-badge-service, [data-theme="dark"] .badge-service { background: #052e16; color: #86efac; }
[data-theme="dark"] .type-badge-provider, [data-theme="dark"] .badge-provider { background: #451a03; color: #fcd34d; }
[data-theme="dark"] .type-badge-layout, [data-theme="dark"] .badge-layout { background: #500724; color: #f9a8d4; }

/* ── HTTP method badges ── */
.method-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: 0.05em;
}
.method-get { background: #dcfce7; color: #15803d; }
.method-post { background: #dbeafe; color: #1d4ed8; }
.method-put { background: #fef3c7; color: #b45309; }
.method-delete { background: #fee2e2; color: #dc2626; }
.method-patch { background: #f3e8ff; color: #7c3aed; }
[data-theme="dark"] .method-get { background: #052e16; color: #86efac; }
[data-theme="dark"] .method-post { background: #172554; color: #93c5fd; }
[data-theme="dark"] .method-put { background: #451a03; color: #fcd34d; }
[data-theme="dark"] .method-delete { background: #450a0a; color: #fca5a5; }
[data-theme="dark"] .method-patch { background: #2e1065; color: #c4b5fd; }

/* ── Color-coded accordion borders ── */
article details.component-accordion {
  border-left: 3px solid var(--primary);
  transition: border-color 0.15s;
}
article details.service-accordion.accordion-hook {
  border-left: 3px solid #8b5cf6;
  transition: border-color 0.15s;
}
article details.service-accordion.accordion-service {
  border-left: 3px solid #22c55e;
  transition: border-color 0.15s;
}
article details.component-accordion[open],
article details.service-accordion[open] {
  border-color: var(--primary);
}
article details.component-accordion summary::marker,
article details.service-accordion summary::marker {
  color: var(--text-muted);
}

/* ── Accordion type badge ── */
.accordion-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: white;
}
.accordion-badge-deps {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

/* ── Left sidebar sub-item ── */
.left-sidebar-sub-item a {
  padding-left: 24px;
  font-size: 0.8rem;
}

/* ── Section stats ── */
.section-stats {
  display: flex;
  gap: 1rem;
  margin: 0.75rem 0 1.5rem;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  flex-wrap: wrap;
}
.section-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}
.section-stat strong {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* ── Memo page enhanced styles ── */
.memo-page-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.memo-page-search svg { color: var(--text-muted); flex-shrink: 0; }
.memo-page-search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
}
.memo-page-search-input::placeholder { color: var(--text-muted); }

.memo-page-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
  margin-bottom: 1rem;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.memo-page-stat-item {
  text-align: center;
  padding: 8px;
}
.memo-page-stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}
.memo-page-stat-label {
  display: block;
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}
.memo-page-stat-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  margin-top: 6px;
  overflow: hidden;
}
.memo-page-stat-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.memo-page-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.memo-page-sort {
  display: flex;
  align-items: center;
  gap: 6px;
}
.memo-page-sort-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}
.memo-page-sort-btn {
  padding: 4px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.memo-page-sort-btn:hover { border-color: var(--primary); color: var(--text); }
.memo-page-sort-btn.active {
  background: var(--primary-subtle);
  color: var(--primary);
  border-color: var(--primary);
}

.memo-page-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.memo-page-item-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}
.memo-page-item-time {
  font-size: 0.7rem;
  color: var(--text-muted);
  flex-shrink: 0;
}
.memo-page-item-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.memo-page-item-delete:hover { color: #ef4444; background: #fef2f2; }
[data-theme="dark"] .memo-page-item-delete:hover { background: #450a0a; }
.memo-page-item-source {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 4px;
}
.memo-page-group-header {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text);
  padding: 8px 0 4px;
  border-bottom: 1px solid var(--border-light);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.memo-page-group-count {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 400;
}

/* ── Global Search ── */
.header-search {
  flex: 1;
  max-width: 320px;
  margin-left: auto;
  margin-right: 8px;
}
.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
  pointer-events: none;
  z-index: 1;
}
.search-input {
  width: 100%;
  padding: 6px 12px 6px 34px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
  background: var(--bg);
}
.search-input::placeholder { color: var(--text-muted); }
.search-shortcut {
  position: absolute;
  right: 8px;
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.7rem;
  color: var(--text-muted);
  font-family: inherit;
  pointer-events: none;
}
.search-input:focus + .search-shortcut { display: none; }
.search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  max-height: 400px;
  overflow-y: auto;
  z-index: 200;
}
.search-result-item {
  display: block;
  padding: 10px 14px;
  text-decoration: none;
  color: var(--text);
  border-bottom: 1px solid var(--border-light);
  transition: background 0.12s;
}
.search-result-item:last-child { border-bottom: none; }
.search-result-item:hover { background: var(--bg-secondary); }
.search-result-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 2px;
}
.search-result-title mark {
  background: var(--primary-light);
  color: var(--primary);
  padding: 0 2px;
  border-radius: 2px;
}
.search-result-snippet {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.search-result-snippet mark {
  background: var(--primary-light);
  color: var(--primary);
  padding: 0 2px;
  border-radius: 2px;
}
.search-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* ── Responsive: hide sidebars below 1100px ── */
@media (max-width: 1100px) {
  .toc-sidebar { display: none; }
  .left-sidebar { display: none; }
  .layout { grid-template-columns: 1fr !important; }
  .content { max-width: 100%; }
}

/* ── Responsive: hamburger menu below 768px ── */
@media (max-width: 768px) {
  .mobile-menu-toggle { display: flex; }
  .top-nav {
    display: none;
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-md);
    padding: 0.5rem;
    z-index: 99;
  }
  .top-nav.open { display: block; }
  .top-nav-list {
    flex-direction: column;
    align-items: stretch;
  }
  .top-nav-link {
    width: 100%;
    padding: 8px 12px;
  }
  .content { padding: 1.25rem 1rem; }
  .header-inner { padding: 0 1rem; }
  .left-sidebar { display: none; }
  .toc-sidebar { display: none; }
  .dashboard { padding: 2rem 1rem; }
  .dashboard-title { font-size: 1.75rem; }
}
`;
}
