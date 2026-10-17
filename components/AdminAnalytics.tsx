'use client';

import React from 'react';
import { AdminStats } from '@/types';

function formatDay(date: string): string {
  const parts = String(date || '').split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}.${parts[1]}`;
}

export function AdminAnalytics({ stats }: { stats: AdminStats }) {
  const maxSessions = Math.max(1, ...stats.daily.map((day) => day.sessions));
  const funnelMax = Math.max(1, stats.funnel.started);

  return (
    <div className="admin-card" style={{ marginTop: 20 }}>
      <div className="admin-card-title">
        <span>Аналитика игроков</span>
        <span className="admin-badge-count">за 30 дней</span>
      </div>

      <div className="analytics-metrics">
        <div className="analytics-metric">
          <span className="am-label">Активных за сутки</span>
          <span className="am-value">{stats.dau}</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Активных за 7 дней</span>
          <span className="am-value">{stats.wau}</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Игр за сутки</span>
          <span className="am-value">{stats.gamesToday}</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Игр за 7 дней</span>
          <span className="am-value">{stats.games7d}</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Доигрывают до конца</span>
          <span className="am-value">{stats.completionRate}%</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Возвращаются играть</span>
          <span className="am-value">{stats.returnRate}%</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Средний счет</span>
          <span className="am-value">{stats.avgScore}</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Средняя точность</span>
          <span className="am-value">{stats.avgAccuracy}%</span>
        </div>
        <div className="analytics-metric">
          <span className="am-label">Одобрено идей</span>
          <span className="am-value">{stats.suggestionConversion}%</span>
        </div>
      </div>

      <div className="analytics-section-title">Игры за 14 дней</div>
      <div className="analytics-chart">
        {stats.daily.map((day) => (
          <div
            key={day.date}
            className="analytics-bar-col"
            title={`${formatDay(day.date)}: ${day.sessions} игр, ${day.players} игроков`}
          >
            <div className="analytics-bar-track">
              <div
                className="analytics-bar"
                style={{ height: `${Math.round((day.sessions / maxSessions) * 100)}%` }}
              ></div>
            </div>
            <span className="analytics-bar-label">{formatDay(day.date)}</span>
          </div>
        ))}
      </div>

      <div className="analytics-section-title">Воронка сессий</div>
      <div className="analytics-funnel">
        <div className="analytics-funnel-row">
          <span>Начали игру</span>
          <div className="analytics-funnel-track">
            <div
              className="analytics-funnel-fill"
              style={{ width: `${Math.round((stats.funnel.started / funnelMax) * 100)}%` }}
            ></div>
          </div>
          <span className="analytics-funnel-value">{stats.funnel.started}</span>
        </div>
        <div className="analytics-funnel-row">
          <span>Ответили хотя бы раз</span>
          <div className="analytics-funnel-track">
            <div
              className="analytics-funnel-fill funnel-played"
              style={{ width: `${Math.round((stats.funnel.played / funnelMax) * 100)}%` }}
            ></div>
          </div>
          <span className="analytics-funnel-value">{stats.funnel.played}</span>
        </div>
        <div className="analytics-funnel-row">
          <span>Сохранили результат</span>
          <div className="analytics-funnel-track">
            <div
              className="analytics-funnel-fill funnel-submitted"
              style={{ width: `${Math.round((stats.funnel.submitted / funnelMax) * 100)}%` }}
            ></div>
          </div>
          <span className="analytics-funnel-value">{stats.funnel.submitted}</span>
        </div>
      </div>

      <div className="analytics-section-title">Самые сложные вопросы</div>
      {stats.hardQuestions.length === 0 ? (
        <p className="analytics-empty">
          Недостаточно данных: статистика появится после нескольких игр в новых сессиях.
        </p>
      ) : (
        <div className="table-responsive">
          <table className="admin-posts-table">
            <thead>
              <tr>
                <th>Автор</th>
                <th>Ответов</th>
                <th>Верных</th>
                <th>Ошибок</th>
              </tr>
            </thead>
            <tbody>
              {stats.hardQuestions.map((question) => (
                <tr key={question.post_id}>
                  <td className="col-author">
                    <strong>{question.author_name || question.post_id}</strong>
                  </td>
                  <td>{question.attempts}</td>
                  <td>{question.correct}</td>
                  <td style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>
                    {question.error_rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
