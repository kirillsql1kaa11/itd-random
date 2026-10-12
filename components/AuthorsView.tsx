'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Author } from '@/types';
import { soundFx } from '@/lib/sound';
import { getAuthorsClient } from '@/lib/authors-client';
import { useVirtualizer } from '@tanstack/react-virtual';

interface AuthorsViewProps {
  onOpenSuggestAuthor: () => void;
}

export function AuthorsView({ onOpenSuggestAuthor }: AuthorsViewProps) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAuthorsClient()
      .then((data) => setAuthors(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = authors.filter((a) => {
    const q = search.toLowerCase();
    return (
      (a.name || '').toLowerCase().includes(q) ||
      (a.handle || '').toLowerCase().includes(q) ||
      (a.bio || '').toLowerCase().includes(q)
    );
  });

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 4,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <section className="app-view">
      <div className="page-header-row">
        <div>
          <h1 className="page-main-title">Авторы ИТД</h1>
          <p className="page-sub-title">Популярные авторы ленты и их индивидуальный стиль</p>
        </div>
        <button
          type="button"
          className="btn-primary-action"
          id="btn-open-suggest-author"
          style={{ fontSize: 12, padding: '8px 16px' }}
          onClick={() => {
            soundFx.playClick();
            onOpenSuggestAuthor();
          }}
        >
          + Предложить автора
        </button>
      </div>

      <div className="authors-search-wrapper">
        <input
          type="text"
          id="authors-search-input"
          className="search-input"
          placeholder="Поиск по имени, @handle или стилю..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div
        ref={parentRef}
        id="public-authors-virtual-container"
        style={{
          maxHeight: 620,
          overflowY: 'auto',
          marginTop: 16,
          paddingRight: 4,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
            {loading ? 'Загрузка авторов...' : 'Авторы не найдены'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualRows.map((virtualRow) => {
              const a = filtered[virtualRow.index];
              const avatarColor = a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)';
              const avatarText = a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?');

              return (
                <div
                  key={a.id || virtualRow.index}
                  className="author-card-public"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="acp-avatar" style={{ background: avatarColor }}>
                      {avatarText}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong className="acp-name">{a.name}</strong>
                        {a.verified && <span className="verified-icon">✓</span>}
                      </div>
                      <span className="acp-handle">{a.handle}</span>
                    </div>
                  </div>

                  {a.badge && <span className="acp-badge-tag">{a.badge}</span>}

                  {a.bio && <p className="acp-bio">{a.bio}</p>}

                  <a
                    href={`https://xn--d1ah4a.com/${a.handle || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="acp-link"
                  >
                    Профиль в ИТД ↗
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pagination-bar" id="public-authors-pagination" style={{ marginTop: 16 }}>
        <div className="pagination-info" id="public-authors-page-info">
          Всего авторов: {filtered.length}
        </div>
      </div>
    </section>
  );
}
