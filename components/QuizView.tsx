'use client';

import React, { useEffect, useState } from 'react';
import { QuizQuestion, GameMode } from '@/types';
import { soundFx } from '@/lib/sound';

interface QuizViewProps {
  question: QuizQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  mode: GameMode;
  score: number;
  streak: number;
  multiplier: number;
  lives: number;
  timeLeft: number;
  maxTime: number;
  isAnswered: boolean;
  selectedAuthorId: string | null;
  correctAuthorId: string | null;
  eliminatedIds: string[];
  hintUsed: boolean;
  hints5050Left: number;
  textHintsLeft: number;
  showTextHint: boolean;
  isLoading: boolean;
  onSelectOption: (authorId: string) => void;
  onUse5050: () => void;
  onUseHint: () => void;
  onSkip?: () => void;
}

export function QuizView({
  question,
  currentIndex,
  totalQuestions,
  mode,
  score,
  streak,
  multiplier,
  lives,
  timeLeft,
  maxTime,
  isAnswered,
  selectedAuthorId,
  correctAuthorId,
  eliminatedIds,
  hintUsed,
  hints5050Left,
  textHintsLeft,
  showTextHint,
  isLoading,
  onSelectOption,
  onUse5050,
  onUseHint,
  onSkip,
}: QuizViewProps) {
  const [zoomImage, setZoomImage] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered || isLoading || !question) return;
      const key = e.key;
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        const opt = question.options[idx];
        if (opt && !eliminatedIds.includes(opt.id)) {
          soundFx.playClick();
          onSelectOption(opt.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, isLoading, question, eliminatedIds, onSelectOption]);

  if (isLoading || !question) {
    return (
      <section className="app-view">
        <div className="quiz-skeleton-card">
          <div className="quiz-skeleton-spinner"></div>
          <span>Загрузка вопроса...</span>
        </div>
      </section>
    );
  }

  const timerPercent = maxTime > 0 ? (timeLeft / maxTime) * 100 : 100;
  const isTimerWarning = timeLeft <= 8 && timeLeft > 4;
  const isTimerDanger = timeLeft <= 4;

  return (
    <section className="app-view">
      <div className="quiz-header-bar">
        <div className="quiz-stats-group">
          <div className="stat-item">
            <span className="stat-label">Очки</span>
            <span className="stat-val">{score}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Серия</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="stat-val">{streak}</span>
              {multiplier > 1 && (
                <span className="streak-multiplier active" style={{ display: 'inline-block' }}>
                  x{multiplier}
                </span>
              )}
            </div>
          </div>

          {mode === 'survival' && (
            <div className="stat-item">
              <span className="stat-label">Жизни</span>
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                {[1, 2, 3].map((h) => (
                  <span
                    key={h}
                    style={{
                      color: h <= lives ? 'var(--accent-danger)' : 'var(--text-muted)',
                      fontSize: 16,
                    }}
                  >
                    ♥
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="quiz-progress-group" style={{ display: 'flex', gap: 16 }}>
          {mode !== 'practice' && (
            <div className="stat-item">
              <span className="stat-label">Время</span>
              <span
                className="stat-val"
                style={{
                  color: isTimerDanger ? 'var(--accent-danger)' : isTimerWarning ? 'var(--accent-amber)' : 'var(--text-primary)',
                }}
              >
                {timeLeft}
              </span>
            </div>
          )}
          <div className="stat-item">
            <span className="stat-label">Раунд</span>
            <span className="stat-val">
              {mode === 'survival' ? currentIndex + 1 : `${currentIndex + 1} / ${totalQuestions}`}
            </span>
          </div>
        </div>
      </div>

      {mode !== 'practice' && (
        <div className="timer-bar-wrapper">
          <div
            className={`timer-bar-fill ${isTimerDanger ? 'danger' : isTimerWarning ? 'warning' : ''}`}
            style={{ width: `${timerPercent}%` }}
          ></div>
        </div>
      )}

      {question.screenshot && (
        <div
          className="post-preview-card"
          onClick={() => setZoomImage(true)}
        >
          <img src={question.screenshot} alt="Скриншот поста" />
          <div className="screenshot-zoom-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <span>Нажмите, чтобы увеличить</span>
          </div>
        </div>
      )}

      <div className="question-prompt">
        <span className="prompt-title">Кто автор этого поста?</span>
        <div className="hints-toolbar">
          <button
            type="button"
            className="btn-hint"
            disabled={isAnswered || hints5050Left <= 0}
            onClick={() => {
              soundFx.playClick();
              onUse5050();
            }}
            title="Убрать два неверных варианта"
          >
            <span>50:50</span>
            <span className="hint-limit-badge">{hints5050Left}</span>
          </button>

          {question.hint && (
            <button
              type="button"
              className="btn-hint"
              disabled={isAnswered || textHintsLeft <= 0 || showTextHint}
              onClick={() => {
                soundFx.playClick();
                onUseHint();
              }}
              title="Показать подсказку к посту (-30 очков)"
            >
              <span>Подсказка</span>
              <span className="hint-limit-badge">{textHintsLeft}</span>
            </button>
          )}

          {mode === 'practice' && onSkip && (
            <button
              type="button"
              className="btn-hint"
              disabled={isAnswered}
              onClick={() => {
                soundFx.playClick();
                onSkip();
              }}
            >
              <span>Пропуск</span>
            </button>
          )}
        </div>
      </div>

      {showTextHint && question.hint && (
        <div className="hint-box">
          Подсказка: {question.hint}
        </div>
      )}

      <div className="options-grid">
        {question.options.map((opt, idx) => {
          const isEliminated = eliminatedIds.includes(opt.id);
          const isSelected = selectedAuthorId === opt.id;
          const isCorrect = correctAuthorId === opt.id;
          const isWrong = isSelected && correctAuthorId && !isCorrect;

          let optionClasses = 'quiz-option-btn';
          if (isEliminated) optionClasses += ' eliminated';
          if (isAnswered) {
            if (isCorrect) optionClasses += ' correct';
            if (isWrong) optionClasses += ' wrong';
          }

          return (
            <button
              key={opt.id}
              type="button"
              className={optionClasses}
              disabled={isAnswered || isEliminated}
              onClick={() => {
                soundFx.playClick();
                onSelectOption(opt.id);
              }}
            >
              <div className="option-key-badge">{idx + 1}</div>
              <div
                className="option-avatar"
                style={{ background: opt.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)' }}
              >
                {opt.avatarText || opt.name[0] || '?'}
              </div>
              <div className="option-meta">
                <div className="option-name-row">
                  <span className="option-name">{opt.name}</span>
                  {opt.verified && <span className="verified-icon">✓</span>}
                </div>
                <span className="option-handle">{opt.handle}</span>
              </div>
            </button>
          );
        })}
      </div>

      {zoomImage && question.screenshot && (
        <div className="lightbox-backdrop" onClick={() => setZoomImage(false)}>
          <div className="lightbox-content">
            <img src={question.screenshot} alt="Скриншот поста" className="lightbox-img" />
          </div>
        </div>
      )}
    </section>
  );
}
