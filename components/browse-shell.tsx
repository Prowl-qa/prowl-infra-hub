'use client';

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import PlaybookCard from '@/components/playbook-card';
import { toDisplayDate } from '@/lib/format';
import type { PlaybookSummary } from '@/lib/playbooks';

const ITEMS_PER_PAGE = 12;

interface BrowseShellProps {
  playbooks: PlaybookSummary[];
}

function buildPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) {
    pages.push('ellipsis');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('ellipsis');
  }

  pages.push(total);
  return pages;
}

export default function BrowseShell({ playbooks }: BrowseShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get('category') || 'all';
  const toolFilter = searchParams.get('tool') || 'all';
  const riskFilter = searchParams.get('risk') || 'all';
  const cloudFilter = searchParams.get('cloud') || 'all';
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);

  const [query, setQuery] = useState('');
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookSummary | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  const modalPanelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const previewRequestIdRef = useRef(0);

  const categories = useMemo(
    () => [
      { key: 'all', label: 'All' },
      ...Array.from(new Set(playbooks.map((p) => p.category))).map((key) => ({
        key,
        label: playbooks.find((p) => p.category === key)?.categoryLabel ?? key,
      })),
    ],
    [playbooks]
  );

  const tools = useMemo(() => {
    const set = new Set(playbooks.map((p) => p.tool));
    return ['all', ...Array.from(set).sort()];
  }, [playbooks]);

  const cloudProviders = useMemo(() => {
    const set = new Set(playbooks.map((p) => p.cloudProvider));
    return ['all', ...Array.from(set).sort()];
  }, [playbooks]);

  const filteredPlaybooks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return playbooks.filter((playbook) => {
      const categoryMatch = category === 'all' || playbook.category === category;
      const toolMatch = toolFilter === 'all' || playbook.tool === toolFilter;
      const riskMatch = riskFilter === 'all' || playbook.riskLevel === riskFilter;
      const cloudMatch = cloudFilter === 'all' || playbook.cloudProvider === cloudFilter;
      const tags = (playbook.tags || []).filter((tag) => tag.trim().length > 0 && !tag.trim().startsWith('#'));
      const queryMatch =
        normalizedQuery.length === 0 ||
        `${playbook.title} ${playbook.description} ${playbook.categoryLabel} ${tags.join(' ')}`.toLowerCase().includes(normalizedQuery);

      return categoryMatch && toolMatch && riskMatch && cloudMatch && queryMatch;
    });
  }, [playbooks, query, category, toolFilter, riskFilter, cloudFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPlaybooks.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedPlaybooks = filteredPlaybooks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const pageNumbers = buildPageNumbers(safePage, totalPages);

  const updateUrl = useCallback(
    (page: number, params: Record<string, string>) => {
      const urlParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== 'all') urlParams.set(key, value);
      }
      if (page > 1) urlParams.set('page', String(page));
      const qs = urlParams.toString();
      router.replace(`/browse${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router]
  );

  const closePreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    setSelectedPlaybook(null);
    setPreviewContent(null);
    setCopyState('idle');
  }, []);

  function handleFilterChange(key: string, value: string) {
    const params: Record<string, string> = { category, tool: toolFilter, risk: riskFilter, cloud: cloudFilter };
    params[key] = value;
    startTransition(() => {
      updateUrl(1, params);
    });
  }

  function handlePageChange(page: number) {
    startTransition(() => {
      updateUrl(page, { category, tool: toolFilter, risk: riskFilter, cloud: cloudFilter });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handlePreview(playbook: PlaybookSummary) {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      triggerRef.current = activeElement;
    }

    const requestId = ++previewRequestIdRef.current;
    setSelectedPlaybook(playbook);
    setPreviewContent(null);
    setCopyState('idle');

    try {
      const response = await fetch(`/api/playbooks/file?path=${encodeURIComponent(playbook.filePath)}&preview=1`);
      if (requestId !== previewRequestIdRef.current) {
        return;
      }
      if (response.ok) {
        setPreviewContent(await response.text());
      } else {
        setPreviewContent('# Failed to load playbook content');
      }
    } catch {
      if (requestId !== previewRequestIdRef.current) {
        return;
      }
      setPreviewContent('# Failed to load playbook content');
    }
  }

  async function handleCopy() {
    if (!previewContent) return;

    try {
      await navigator.clipboard.writeText(previewContent);
      setCopyState('done');
    } catch {
      setCopyState('failed');
    }

    window.setTimeout(() => {
      setCopyState('idle');
    }, 1400);
  }

  useEffect(() => {
    if (!selectedPlaybook) {
      if (triggerRef.current) {
        triggerRef.current.focus();
        triggerRef.current = null;
      }
      return;
    }

    const dialog = modalPanelRef.current;
    if (!dialog) {
      return;
    }
    const dialogElement: HTMLDivElement = dialog;

    const initialFocus = closeButtonRef.current ?? dialogElement;
    initialFocus.focus();

    const getFocusableElements = () =>
      Array.from(
        dialogElement.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');

    function handleDialogKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        dialogElement.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!activeElement || !dialogElement.contains(activeElement) || activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!activeElement || !dialogElement.contains(activeElement) || activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialogElement.addEventListener('keydown', handleDialogKeydown);
    return () => dialogElement.removeEventListener('keydown', handleDialogKeydown);
  }, [closePreview, selectedPlaybook]);

  return (
    <>
      <div className="controls" role="region" aria-label="Playbook filters">
        <label className="search-field" htmlFor="browse-search">
          <span>Search playbooks</span>
          <input
            id="browse-search"
            type="search"
            placeholder="Try patching, nginx, docker..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="chip-row" role="list" aria-label="Categories">
          {categories.map((entry) => (
            <div key={entry.key} role="listitem">
              <button
                type="button"
                className={category === entry.key ? 'is-active' : ''}
                onClick={() => handleFilterChange('category', entry.key)}
              >
                {entry.label}
              </button>
            </div>
          ))}
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label htmlFor="filter-tool">Tool</label>
            <select
              id="filter-tool"
              value={toolFilter}
              onChange={(e) => handleFilterChange('tool', e.target.value)}
            >
              {tools.map((t) => (
                <option key={t} value={t}>{t === 'all' ? 'All tools' : t}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-risk">Risk Level</label>
            <select
              id="filter-risk"
              value={riskFilter}
              onChange={(e) => handleFilterChange('risk', e.target.value)}
            >
              <option value="all">All levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-cloud">Cloud Provider</label>
            <select
              id="filter-cloud"
              value={cloudFilter}
              onChange={(e) => handleFilterChange('cloud', e.target.value)}
            >
              {cloudProviders.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All providers' : c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p className="results-count" aria-live="polite">
        Showing {paginatedPlaybooks.length} of {filteredPlaybooks.length} playbook{filteredPlaybooks.length !== 1 ? 's' : ''}
      </p>

      <div className="playbook-grid">
        {paginatedPlaybooks.length === 0 ? (
          <div className="empty-state">No verified playbooks match that filter yet.</div>
        ) : (
          paginatedPlaybooks.map((playbook) => (
            <PlaybookCard
              key={playbook.id}
              playbook={playbook}
              onPreview={() => handlePreview(playbook)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <nav aria-label="Pagination">
            <button
              type="button"
              className="page-link"
              disabled={safePage <= 1}
              onClick={() => handlePageChange(safePage - 1)}
              aria-label="Previous page"
            >
              Previous
            </button>

            {pageNumbers.map((entry, index) =>
              entry === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="page-ellipsis" aria-hidden="true">
                  &hellip;
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  className={`page-link${safePage === entry ? ' is-active' : ''}`}
                  onClick={() => handlePageChange(entry)}
                  aria-label={`Page ${entry}`}
                  aria-current={safePage === entry ? 'page' : undefined}
                >
                  {entry}
                </button>
              )
            )}

            <button
              type="button"
              className="page-link"
              disabled={safePage >= totalPages}
              onClick={() => handlePageChange(safePage + 1)}
              aria-label="Next page"
            >
              Next
            </button>
          </nav>
        </div>
      )}

      {selectedPlaybook && (
        <div className="modal-backdrop" role="presentation" onClick={closePreview}>
          <div
            ref={modalPanelRef}
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h3 id="preview-title">{selectedPlaybook.title}</h3>
              <button ref={closeButtonRef} type="button" className="icon-button" onClick={closePreview}>
                Close
              </button>
            </div>

            <p className="dialog-meta">
              {selectedPlaybook.categoryLabel} | {selectedPlaybook.tool} | {selectedPlaybook.riskLevel} risk | {selectedPlaybook.taskCount} tasks | Updated{' '}
              {toDisplayDate(selectedPlaybook.updatedAt)}
            </p>

            <pre>
              <code>{previewContent ?? 'Loading...'}</code>
            </pre>

            <div className="dialog-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={handleCopy}
                disabled={!previewContent}
              >
                {copyState === 'done' && 'Copied'}
                {copyState === 'failed' && 'Copy failed'}
                {copyState === 'idle' && 'Copy YAML'}
              </button>
              <a
                className="button button-primary"
                href={`/api/playbooks/file?path=${encodeURIComponent(selectedPlaybook.filePath)}`}
                download={selectedPlaybook.filePath.split('/').pop() || 'playbook.yml'}
              >
                Download file
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
