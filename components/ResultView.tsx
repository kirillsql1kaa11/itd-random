'use client';

import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { generateShareCard } from '@/lib/sharecard';
import { soundFx } from '@/lib/sound';
import { GameMode } from '@/types';

interface ResultViewProps {
  score: number;
  accuracy: number;
  maxStreak: number;
  correctCount: number;
  totalCount: number;
  mode: GameMode;
  nickname: string;
  sessionToken: string | null;
  history?: Array<{
    post: any;
    correctAuthor: {
      name: string;
      handle: string;
    };
    chosenAuthorId: string | null;
    isCorrect: boolean;
  }>;
  onPlayAgain: () => void;
  onGoHome: () => void;
  onGoLeaderboard?: () => void;
}

export function ResultView({
  score,
  accuracy,
  maxStreak,
  correctCount,
  totalCount,
  mode,
  nickname,
  sessionToken,
  history = [],
  onPlayAgain,
  onGoHome,
  onGoLeaderboard,
}: ResultViewProps) {
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (accuracy >= 60 || score > 500) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0080ff', '#00ba7c', '#f59e0b', '#ec4899'],
        });
      } catch {}
    }

    generateShareCard({
      nickname: nickname || 'Аноним',
      score,
      accuracy,
      streak: maxStreak,
      mode,
    }).then((img) => {
      if (img) setShareImage(img);
    });

    if (sessionToken) {
      fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_score',
          sessionToken,
          nickname: nickname || 'Аноним',
        }),
      }).catch(() => {});
    }
  }, []);

  const handleCopyImage = async () => {
    soundFx.playClick();
    if (!shareImage) return;
    try {
      const res = await fetch(shareImage);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopyFeedback('Картинка скопирована!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      const a = document.createElement('a');
      a.href = shareImage;
      a.download = `itd-result-${score}.png`;
      a.click();
    }
  };

  const handleShareItd = () => {
    soundFx.playClick();
    const text = `Мой результат в викторине ИТД: ${score} очков (точность ${accuracy}%, серия ${maxStreak})! Попробуй угадать: https://итд.com/`;
    window.open(`https://xn--d1ah4a.com/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyText = async () => {
    soundFx.playClick();
    const text = `Мой результат в викторине ИТД: ${score} очков, точность ${accuracy}%, максимальная серия ${maxStreak}! Сыграй сам: https://итд.com/`;
    await navigator.clipboard.writeText(text);
    setCopyFeedback('Текст скопирован!');
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  let rankText = 'Новичок в ИТД';
  if (accuracy >= 90) rankText = 'Легенда ИТД';
  else if (accuracy >= 70) rankText = 'Знаток ленты ИТД';
  else if (accuracy >= 50) rankText = 'Внимательный скроллер';
  else if (accuracy >= 30) rankText = 'Случайный читатель';

  return (
    <section className="app-view" id="view-summary">
      <div className="summary-card">
        <div className="summary-badge-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="7"></circle>
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
          </svg>
        </div>
        <h2 className="summary-title">Раунд завершен</h2>
        <div className="summary-rank" id="sum-rank">{rankText}</div>

        <div className="summary-stats-grid">
          <div className="summary-stat-box">
            <div className="val" id="sum-score">{score}</div>
            <div className="lbl">Очков набрано</div>
          </div>
          <div className="summary-stat-box">
            <div className="val" id="sum-max-streak">{maxStreak}</div>
            <div className="lbl">Макс. серия</div>
          </div>
          <div className="summary-stat-box">
            <div className="val" id="sum-accuracy">{accuracy}%</div>
            <div className="lbl">Точность</div>
          </div>
        </div>

        {shareImage && (
          <div className="share-card-wrapper" id="share-card-wrapper">
            <img
              src={shareImage}
              alt="Карточка результата"
              className="share-card-preview"
              id="share-card-preview"
              style={{ display: 'block' }}
            />
          </div>
        )}

        {copyFeedback && (
          <div style={{ color: 'var(--accent-green)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            {copyFeedback}
          </div>
        )}

        <div className="summary-actions">
          <button
            type="button"
            className="btn-primary-action summary-play-btn"
            id="btn-play-again"
            onClick={() => {
              soundFx.playClick();
              onPlayAgain();
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Сыграть еще раз</span>
          </button>

          <div className="summary-share-grid">
            <button
              type="button"
              className="btn-secondary-action share-btn"
              id="btn-copy-card"
              onClick={handleCopyImage}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Скопировать картинку</span>
            </button>

            <button
              type="button"
              className="btn-secondary-action share-btn"
              id="btn-share-itd"
              onClick={handleShareItd}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span>Поделиться в ИТД</span>
            </button>

            <button
              type="button"
              className="btn-secondary-action share-btn"
              id="btn-share-results"
              onClick={handleCopyText}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              <span>Скопировать текст</span>
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={onGoHome}
              style={{ fontSize: 13, padding: '8px 20px' }}
            >
              ← Вернуться на главную
            </button>
            {onGoLeaderboard && (
              <button
                type="button"
                className="btn-secondary-action"
                onClick={() => {
                  soundFx.playClick();
                  onGoLeaderboard();
                }}
                style={{ fontSize: 13, padding: '8px 20px' }}
              >
                Таблица рекордов ➔
              </button>
            )}
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <>
          <h3 className="summary-history-title">Разбор постов раунда:</h3>
          <div className="summary-history-list" id="summary-history-list">
            {history.map((item, idx) => (
              <div
                key={idx}
                className={`summary-history-item ${item.isCorrect ? 'correct' : 'wrong'}`}
              >
                <div className="shi-status">{item.isCorrect ? '✓' : '✕'}</div>
                <div className="shi-body">
                  <div className="shi-snippet">
                    {item.post?.postText || 'Скриншот поста'}
                  </div>
                  <div className="shi-meta">
                    Автор: <strong>{item.correctAuthor?.name || 'Автор'}</strong> ({item.correctAuthor?.handle || '@handle'})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
