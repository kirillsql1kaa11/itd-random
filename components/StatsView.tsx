'use client';

import React, { useEffect, useState } from 'react';
import { UserStats } from '@/types';
import { soundFx } from '@/lib/sound';

export function StatsView() {
  const [stats, setStats] = useState<UserStats>({
    gamesPlayed: 0,
    totalScore: 0,
    bestScore: 0,
    maxStreak: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    history: [],
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('itd_user_stats');
      if (saved) {
        setStats(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const handleReset = () => {
    soundFx.playClick();
    if (!window.confirm('Сбросить сохраненную локальную статистику?')) return;
    const initial: UserStats = {
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      maxStreak: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      history: [],
    };
    setStats(initial);
    localStorage.removeItem('itd_user_stats');
  };

  const avgAccuracy =
    stats.totalAnswers > 0
      ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100)
      : 0;

  return (
    <section className="app-view">
      <div className="page-header-row">
        <div>
          <h1 className="page-main-title">Ваша статистика</h1>
          <p className="page-sub-title">Локальные показатели на этом устройстве</p>
        </div>
        {stats.gamesPlayed > 0 && (
          <button
            type="button"
            className="btn-secondary-action"
            onClick={handleReset}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            Сбросить данные
          </button>
        )}
      </div>

      <div className="summary-stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginTop: 16 }}>
        <div className="summary-stat-box">
          <div className="val" id="stat-display-games">{stats.gamesPlayed}</div>
          <div className="lbl">Игр сыграно</div>
        </div>
        <div className="summary-stat-box">
          <div className="val" id="stat-display-score">{stats.totalScore}</div>
          <div className="lbl">Всего очков</div>
        </div>
        <div className="summary-stat-box">
          <div className="val" id="stat-display-streak">{stats.maxStreak}</div>
          <div className="lbl">Рекорд серии</div>
        </div>
        <div className="summary-stat-box">
          <div className="val" id="stat-display-accuracy">{avgAccuracy}%</div>
          <div className="lbl">Общая точность</div>
        </div>
      </div>

      <h3 className="summary-history-title">История недавних партий:</h3>
      {stats.history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          Вы еще не сыграли ни одной игры
        </div>
      ) : (
        <div className="summary-history-list">
          {stats.history.slice(-10).reverse().map((h, i) => (
            <div key={i} className="summary-history-item correct">
              <div className="shi-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="shi-snippet">
                    {h.mode === 'blitz' ? 'Блиц 10' : h.mode === 'survival' ? 'Выживание' : 'Свободный'}
                  </div>
                  <div className="shi-meta">{h.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: 16, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {h.score} очков
                  </strong>
                  <div style={{ fontSize: 11, color: 'var(--accent-green)' }}>
                    Точность {h.accuracy}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
