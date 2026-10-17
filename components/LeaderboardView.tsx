'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LeaderboardRecord } from '@/types';
import { soundFx } from '@/lib/sound';

const MODES = [
  { id: 'all', label: 'Все' },
  { id: 'blitz', label: 'Блиц 10' },
  { id: 'survival', label: 'Выживание' },
  { id: 'practice', label: 'Свободный' },
] as const;

type ModeId = (typeof MODES)[number]['id'];

const PAGE_SIZE = 20;

export function LeaderboardView() {
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<ModeId>('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadLeaderboard = useCallback(async (mode: ModeId, targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/leaderboard?mode=${mode}&page=${targetPage}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Ошибка загрузки');
      }
      setRecords(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      setTotal(Number(data.total) || 0);
      setPages(Math.max(1, Number(data.pages) || 1));
    } catch {
      setRecords([]);
      setTotal(0);
      setPages(1);
      setError('Не удалось загрузить рейтинг');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard(filterMode, page);
  }, [filterMode, page, loadLeaderboard]);

  const changeMode = (mode: ModeId) => {
    soundFx.playClick();
    setPage(1);
    setFilterMode(mode);
  };

  const goToPage = (next: number) => {
    soundFx.playClick();
    setPage(Math.min(Math.max(1, next), pages));
  };

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
            loadLeaderboard(filterMode, page);
          }}
        >
          {loading ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      <div className="mode-pills" style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`btn-mode-select ${filterMode === mode.id ? 'active' : ''}`}
            onClick={() => changeMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="table-responsive" style={{ marginTop: 16 }}>
        <table className="admin-posts-table">
          <thead>
            <tr>
              <th style={{ width: 62 }}>Место</th>
              <th>Игрок</th>
              <th>Очки</th>
              <th>Серия</th>
              <th>Точность</th>
              <th>Режим</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  {loading ? 'Загрузка рейтинга...' : error || 'Нет записей в выбранном режиме'}
                </td>
              </tr>
            ) : (
              records.map((record, index) => {
                const globalRank = (page - 1) * PAGE_SIZE + index + 1;
                let medalClass = '';
                if (globalRank === 1) medalClass = 'rank-1';
                else if (globalRank === 2) medalClass = 'rank-2';
                else if (globalRank === 3) medalClass = 'rank-3';

                return (
                  <tr key={record.id || `${record.nickname}-${globalRank}`}>
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
                      <strong style={{ color: 'var(--text-primary)' }}>{record.nickname}</strong>
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {record.score}
                    </td>
                    <td style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>
                      x{record.streak}
                    </td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                      {record.accuracy}%
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {record.mode === 'blitz' ? 'Блиц 10' : record.mode === 'survival' ? 'Выживание' : 'Свободный'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination-bar" style={{ marginTop: 16 }}>
        <div className="admin-pagination-info">
          Всего записей: {total}
        </div>
        <div className="admin-pagination-controls">
          <button
            type="button"
            className="btn-page-nav"
            disabled={loading || page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            ← Назад
          </button>
          <span className="admin-pagination-page">
            {page} / {pages}
          </span>
          <button
            type="button"
            className="btn-page-nav"
            disabled={loading || page >= pages}
            onClick={() => goToPage(page + 1)}
          >
            Вперед →
          </button>
        </div>
      </div>
    </section>
  );
}
