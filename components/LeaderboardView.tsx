'use client';

import React, { useEffect, useState, useRef } from 'react';
import { LeaderboardRecord } from '@/types';
import { soundFx } from '@/lib/sound';
import { useVirtualizer } from '@tanstack/react-virtual';

export function LeaderboardView() {
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'blitz' | 'survival' | 'practice'>('all');
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  const rowVirtualizer = useVirtualizer({
    count: filteredRecords.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

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
          }}
        >
          Свободный
        </button>
      </div>

      <div className="table-responsive" ref={tableContainerRef} style={{ marginTop: 16, maxHeight: 520, overflowY: 'auto' }}>
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
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty">
                  {loading ? 'Загрузка рейтинга...' : 'Нет записей в выбранном режиме'}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={6} style={{ height: `${paddingTop}px`, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const r = filteredRecords[virtualRow.index];
                  const globalRank = virtualRow.index + 1;
                  let medalClass = '';
                  if (globalRank === 1) medalClass = 'rank-1';
                  else if (globalRank === 2) medalClass = 'rank-2';
                  else if (globalRank === 3) medalClass = 'rank-3';

                  return (
                    <tr key={r.id || virtualRow.index} style={{ height: 48 }}>
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
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={6} style={{ height: `${paddingBottom}px`, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-pagination-bar" id="leaderboard-pagination" style={{ marginTop: 16 }}>
        <div className="admin-pagination-info" id="leaderboard-page-info">
          Записей: {filteredRecords.length}
        </div>
      </div>
    </section>
  );
}
