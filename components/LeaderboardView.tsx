'use client';

import React, { useEffect, useState } from 'react';
import { LeaderboardRecord } from '@/types';
import { soundFx } from '@/lib/sound';

export function LeaderboardView() {
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'blitz' | 'survival' | 'practice'>('all');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard?limit=100');
      const data = await res.json();
      if (data && data.ok) {
        setRecords(data.leaderboard || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const filteredRecords = filterMode === 'all'
    ? records
    : records.filter((r) => r.mode === filterMode);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / perPage));
  const paginated = filteredRecords.slice((page - 1) * perPage, page * perPage);

  return (
    <section className="app-view">
      <div className="page-header-row">
        <div>
          <h1 className="page-main-title">Рейтинг игроков</h1>
          <p className="page-sub-title">Таблица рекордов по набранным очкам и сериям</p>
        </div>
        <button
          type="button"
          className="btn-secondary-action"
          disabled={loading}
          onClick={() => {
            soundFx.playClick();
            loadLeaderboard();
          }}
        >
          {loading ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      <div className="mode-pills" style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn-mode-select ${filterMode === 'all' ? 'active' : ''}`}
          onClick={() => {
            soundFx.playClick();
            setFilterMode('all');
            setPage(1);
          }}
        >
          Все
        </button>
        <button
          type="button"
          className={`btn-mode-select ${filterMode === 'blitz' ? 'active' : ''}`}
          onClick={() => {
            soundFx.playClick();
            setFilterMode('blitz');
            setPage(1);
          }}
        >
          Блиц 10
        </button>
        <button
          type="button"
          className={`btn-mode-select ${filterMode === 'survival' ? 'active' : ''}`}
          onClick={() => {
            soundFx.playClick();
            setFilterMode('survival');
            setPage(1);
          }}
        >
          Выживание
        </button>
        <button
          type="button"
          className={`btn-mode-select ${filterMode === 'practice' ? 'active' : ''}`}
          onClick={() => {
            soundFx.playClick();
            setFilterMode('practice');
            setPage(1);
          }}
        >
          Свободный
        </button>
      </div>

      <div className="table-responsive" style={{ marginTop: 16 }}>
        <table className="admin-posts-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>Место</th>
              <th>Игрок</th>
              <th>Очки</th>
              <th>Серия</th>
              <th>Точность</th>
              <th>Режим</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  {loading ? 'Загрузка рейтинга...' : 'Нет записей в выбранном режиме'}
                </td>
              </tr>
            ) : (
              paginated.map((r, idx) => {
                const globalRank = (page - 1) * perPage + idx + 1;
                let medalClass = '';
                if (globalRank === 1) medalClass = 'rank-1';
                else if (globalRank === 2) medalClass = 'rank-2';
                else if (globalRank === 3) medalClass = 'rank-3';

                return (
                  <tr key={r.id || idx}>
                    <td>
                      {medalClass ? (
                        <span className={`lb-medal ${medalClass}`}>{globalRank}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 6 }}>
                          {globalRank}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{r.nickname}</strong>
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {r.score}
                    </td>
                    <td style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
                      x{r.streak}
                    </td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                      {r.accuracy}%
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {r.mode === 'blitz' ? 'Блиц 10' : r.mode === 'survival' ? 'Выживание' : 'Свободный'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination-bar" id="leaderboard-pagination" style={{ marginTop: 16 }}>
        <div className="admin-pagination-info" id="leaderboard-page-info">
          {filteredRecords.length} записей
        </div>
        <div className="admin-pagination-controls">
          <button
            type="button"
            className="btn-page-nav"
            id="btn-lb-prev"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Назад
          </button>
          <span className="admin-page-number" id="lb-page-number">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn-page-nav"
            id="btn-lb-next"
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
