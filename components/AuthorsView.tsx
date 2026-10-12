'use client';

import React, { useEffect, useState } from 'react';
import { Author } from '@/types';
import { soundFx } from '@/lib/sound';
import { getAuthorsClient } from '@/lib/authors-client';

interface AuthorsViewProps {
  onOpenSuggestAuthor: () => void;
}

export function AuthorsView({ onOpenSuggestAuthor }: AuthorsViewProps) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="authors-catalog-grid" id="public-authors-grid">
        {paginated.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
            {loading ? 'Загрузка авторов...' : 'Авторы не найдены'}
          </div>
        ) : (
          paginated.map((a) => {
            const avatarColor = a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)';
            const avatarText = a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?');

            return (
              <div key={a.id} className="author-card-public">
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
          })
        )}
      </div>

      <div className="pagination-bar" id="public-authors-pagination" style={{ marginTop: 16 }}>
        <div className="pagination-info" id="public-authors-page-info">
          {filtered.length} авторов
        </div>
        <div className="pagination-controls">
          <button
            type="button"
            className="btn-page-nav"
            id="btn-public-authors-prev"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Назад
          </button>
          <span className="pagination-page-number" id="public-authors-page-number">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn-page-nav"
            id="btn-public-authors-next"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Вперед →
          </button>
        </div>
      </div>
    </section>
  );
}
