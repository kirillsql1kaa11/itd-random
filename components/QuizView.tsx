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
  earnedPoints?: number;
  correctAuthor?: any;
  onSelectOption: (authorId: string) => void;
  onUse5050: () => void;
  onUseHint: () => void;
  onNextQuestion: () => void;
  onFinishPractice?: () => void;
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
  earnedPoints = 0,
  correctAuthor,
  onSelectOption,
  onUse5050,
  onUseHint,
  onNextQuestion,
  onFinishPractice,
  onSkip,
}: QuizViewProps) {
  const [zoomImage, setZoomImage] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading || !question) return;

      if (!isAnswered) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          const opt = question.options[idx];
          if (opt && !eliminatedIds.includes(opt.id)) {
            soundFx.playClick();
            onSelectOption(opt.id);
          }
        } else if (['h', 'H', 'р', 'Р'].includes(e.key)) {
          if (!showTextHint && textHintsLeft > 0) {
            soundFx.playClick();
            onUseHint();
          }
        } else if (['f', 'F', 'а', 'А', '5'].includes(e.key)) {
          if (hints5050Left > 0) {
            soundFx.playClick();
            onUse5050();
          }
        }
      } else {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          onNextQuestion();
        }
      }

      if (['z', 'Z', 'я', 'Я'].includes(e.key)) {
        setZoomImage((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (zoomImage) {
          setZoomImage(false);
        } else if (mode === 'practice' && onFinishPractice) {
          onFinishPractice();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAnswered,
    isLoading,
    question,
    eliminatedIds,
    onSelectOption,
    showTextHint,
    textHintsLeft,
    onUseHint,
    hints5050Left,
    onUse5050,
    onNextQuestion,
    zoomImage,
    mode,
    onFinishPractice,
  ]);

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
  const isCorrect = Boolean(selectedAuthorId && correctAuthorId && selectedAuthorId === correctAuthorId);

  const resolvedAuthor = correctAuthor || (correctAuthorId ? question.options.find((o) => o.id === correctAuthorId) : null);
  let postUrl = '';
  if (question.hint && question.hint.startsWith('Оригинал: ')) {
    postUrl = question.hint.replace('Оригинал: ', '').trim();
  }
  let profileUrl = 'https://xn--d1ah4a.com/';
  const rawHandle = (resolvedAuthor?.handle || resolvedAuthor?.id || '').trim();
  if (rawHandle) {
    const cleanHandle = rawHandle.replace(/^@+/, '');
    if (cleanHandle) {
      profileUrl = `https://xn--d1ah4a.com/@${encodeURIComponent(cleanHandle)}`;
    }
  }
  const targetUrl = postUrl || profileUrl;
  const targetLinkText = postUrl ? 'Открыть пост в ИТД ↗' : 'Профиль в ИТД ↗';

  return (
    <section className="app-view" id="view-quiz">
      <div className="quiz-header-bar">
        <div className="quiz-stats-group">
          <div className="stat-item">
            <span className="stat-label">Очки</span>
            <span className="stat-val" id="stat-score">{score}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Серия</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="stat-val" id="stat-streak">{streak}</span>
              {multiplier > 1 && (
                <span className="streak-multiplier active" id="stat-multiplier" style={{ display: 'inline-block' }}>
                  x{multiplier}
                </span>
              )}
            </div>
          </div>

          {mode === 'survival' && (
            <div className="stat-item" id="quiz-lives-container">
              <span className="stat-label">Жизни</span>
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }} id="lives-display">
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

        <div className="quiz-progress-group" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {mode !== 'practice' && (
            <div className="stat-item" id="quiz-timer-container">
              <span className="stat-label">Время</span>
              <span
                className="stat-val timer-val"
                id="stat-timer"
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
            <span className="stat-val" id="stat-round-label">
              {mode === 'survival' ? `Раунд ${currentIndex + 1} / ${totalQuestions}` : `Пост ${currentIndex + 1} / ${totalQuestions}`}
            </span>
          </div>
          {mode === 'practice' && onFinishPractice && (
            <button
              type="button"
              className="btn-finish-quiz-pill"
              id="btn-quiz-finish"
              title="Завершить игру и сохранить результат"
              onClick={onFinishPractice}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
              <span>Закончить</span>
            </button>
          )}
        </div>
      </div>

      {mode !== 'practice' && (
        <div className="timer-bar-wrapper" id="quiz-timer-box">
          <div
            className={`timer-bar-fill ${isTimerDanger ? 'danger' : isTimerWarning ? 'warning' : ''}`}
            id="timer-progress-fill"
            style={{ width: `${timerPercent}%` }}
          ></div>
        </div>
      )}

      {question.screenshot && (
        <div
          className="post-preview-card"
          id="post-screenshot-container"
          onClick={() => setZoomImage(true)}
          title="Нажмите, чтобы приблизить скриншот"
        >
          <img id="post-screenshot-img" src={question.screenshot} alt="Скриншот поста ИТД" />
          <div className="screenshot-zoom-hint">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Зум [Z]</span>
          </div>
        </div>
      )}

      <div className="question-prompt">
        <span className="prompt-title">Кто написал этот пост?</span>
        <div className="hints-toolbar" id="quiz-hints-toolbar">
          <button
            type="button"
            className={`btn-hint ${hints5050Left <= 0 ? 'used' : ''}`}
            id="btn-hint-5050"
            disabled={isAnswered || hints5050Left <= 0}
            onClick={() => {
              soundFx.playClick();
              onUse5050();
            }}
            title="Исключить 2 неверных варианта (штраф -30 очков, 1 раз за игру)"
          >
            <span>50/50 [F]</span>
            <span className="hint-limit-badge" id="badge-hint-5050">{hints5050Left}/1</span>
          </button>

          {question.hint && (
            <button
              type="button"
              className={`btn-hint ${textHintsLeft <= 0 ? 'used' : ''}`}
              id="btn-use-hint"
              disabled={isAnswered || textHintsLeft <= 0 || showTextHint}
              onClick={() => {
                soundFx.playClick();
                onUseHint();
              }}
              title="Показать подсказку автора (штраф -30 очков, 3 раза за игру)"
            >
              <span>Подсказка [H]</span>
              <span className="hint-limit-badge" id="badge-hint-text">{textHintsLeft}/3</span>
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
        <div className="hint-box" id="hint-content">
          Подсказка: {question.hint}
        </div>
      )}

      <div className="options-grid" id="quiz-options-grid">
        {question.options.map((opt, idx) => {
          const isEliminated = eliminatedIds.includes(opt.id);
          const isSelected = selectedAuthorId === opt.id;
          const isOptCorrect = correctAuthorId === opt.id;
          const isOptWrong = isSelected && correctAuthorId && !isOptCorrect;

          let optionClasses = 'quiz-option-btn';
          if (isEliminated) optionClasses += ' eliminated';
          if (isAnswered) {
            if (isOptCorrect) optionClasses += ' correct';
            if (isOptWrong) optionClasses += ' wrong';
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
                  {opt.verified && <span className="verified-icon" title="Верифицирован">✓</span>}
                </div>
                <span className="option-handle">{opt.handle}</span>
              </div>
            </button>
          );
        })}
      </div>

      {isAnswered && resolvedAuthor && (
        <div
          className={`author-reveal-card ${isCorrect ? 'reveal-correct' : 'reveal-wrong'}`}
          id="author-reveal-card"
        >
          <div className="reveal-title" id="reveal-title">
            <span className="reveal-status-icon">{isCorrect ? '✓' : '✕'}</span>{' '}
            {isCorrect ? `Верно! (+${earnedPoints} очков)` : 'Неверно. Автор поста:'}
          </div>
          <div className="reveal-author-profile">
            <div
              className="reveal-avatar"
              id="reveal-avatar"
              style={{
                background: resolvedAuthor.avatarColor || resolvedAuthor.avatar_color || 'linear-gradient(135deg, #0288d1, #26c6da)',
              }}
            >
              {resolvedAuthor.avatarText || resolvedAuthor.avatar_text || resolvedAuthor.name?.[0] || '?'}
            </div>
            <div className="reveal-info">
              <div className="reveal-name" id="reveal-name">{resolvedAuthor.name}</div>
              <div className="reveal-handle" id="reveal-handle">{resolvedAuthor.handle || '@' + resolvedAuthor.id}</div>
              <div className="reveal-bio" id="reveal-bio">
                {resolvedAuthor.bio || resolvedAuthor.style || 'Популярный автор в ИТД'}
              </div>
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="reveal-itd-link"
                id="reveal-itd-link"
              >
                {targetLinkText}
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="quiz-controls-row" id="quiz-controls-row">
        {mode === 'practice' && onFinishPractice && (
          <button
            type="button"
            className="btn-finish-practice"
            id="btn-finish-practice"
            onClick={onFinishPractice}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>Закончить игру</span>
          </button>
        )}
        {isAnswered && (
          <button
            type="button"
            className="btn-primary-action"
            id="btn-next-question"
            onClick={onNextQuestion}
          >
            <span>{currentIndex + 1 >= totalQuestions ? 'К результатам ➔' : 'Следующий пост ➔'}</span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>[Пробел]</span>
          </button>
        )}
      </div>

      {zoomImage && question.screenshot && (
        <div className="lightbox-backdrop" id="image-lightbox" onClick={() => setZoomImage(false)}>
          <div className="lightbox-content">
            <img src={question.screenshot} alt="Скриншот поста ИТД" className="lightbox-img" id="lightbox-img" />
          </div>
        </div>
      )}
    </section>
  );
}
