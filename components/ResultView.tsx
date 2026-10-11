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
  onPlayAgain: () => void;
  onGoHome: () => void;
  onLeaderboardSubmitted?: () => void;
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
  onPlayAgain,
  onGoHome,
  onLeaderboardSubmitted,
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
      })
        .then((res) => {
          if (res.ok && onLeaderboardSubmitted) onLeaderboardSubmitted();
        })
        .catch(() => {});
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

  let rankText = 'Новичок ИТД';
  if (score > 1500) rankText = 'Легенда ИТД';
  else if (score > 1000) rankText = 'Ветеран ленты';
  else if (score > 500) rankText = 'Знаток ИТД';

  return (
    <section className="app-view">
      <div className="summary-card">
        <h2 className="summary-title">Раунд завершен!</h2>
        <div className="summary-rank">{rankText}</div>

        <div className="summary-stats-grid">
          <div className="summary-stat-box">
            <div className="val">{score}</div>
            <div className="lbl">Очки</div>
          </div>
          <div className="summary-stat-box">
            <div className="val">{maxStreak}</div>
            <div className="lbl">Макс. серия</div>
          </div>
          <div className="summary-stat-box">
            <div className="val">{accuracy}%</div>
            <div className="lbl">Точность</div>
          </div>
        </div>

        {shareImage && (
          <div className="share-card-wrapper">
            <img
              src={shareImage}
              alt="Карточка результата"
              className="share-card-preview"
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
              onClick={handleCopyText}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              <span>Скопировать текст</span>
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={onGoHome}
              style={{ fontSize: 13, padding: '8px 20px' }}
            >
              ← Вернуться на главную
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
