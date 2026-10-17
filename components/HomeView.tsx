'use client';

import React from 'react';
import Link from 'next/link';
import { GameMode } from '@/types';
import { generateRandomNickname } from '@/lib/utils';
import { soundFx } from '@/lib/sound';
import { useApp } from './AppProvider';

export function HomeView() {
  const {
    nickname,
    handleNicknameChange,
    selectedMode,
    setSelectedMode,
    startQuiz,
    openSuggestPost,
  } = useApp();

  const handleRandomizeNick = () => {
    soundFx.playClick();
    handleNicknameChange(generateRandomNickname());
  };

  const selectMode = (mode: GameMode) => {
    soundFx.playClick();
    setSelectedMode(mode);
  };

  return (
    <section className="app-view">
      <div className="home-hero-card">
        <div className="home-hero-header">
          <span className="home-hero-tag">Викторина по соцсети ИТД</span>
          <h1 className="home-hero-title">Угадай, кто написал пост</h1>
          <p className="home-hero-subtitle">
            Определяй авторов по скриншотам постов, стилю текста и шуткам. Соревнуйся в рейтинге лучших скроллеров ИТД.
          </p>
        </div>

        <div className="home-player-setup">
          <div className="form-group" style={{ marginBottom: 16 }}>
            <div className="nickname-label-row">
              <label className="form-label" htmlFor="home-nickname-input" style={{ marginBottom: 0 }}>
                Ваш игровой никнейм
              </label>
              <button
                type="button"
                className="btn-random-nick"
                onClick={handleRandomizeNick}
                title="Сгенерировать случайный ник"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <circle cx="15.5" cy="8.5" r="1.5"></circle>
                  <circle cx="8.5" cy="15.5" r="1.5"></circle>
                  <circle cx="15.5" cy="15.5" r="1.5"></circle>
                  <circle cx="12" cy="12" r="1.5"></circle>
                </svg>
                <span>Случайный ник</span>
              </button>
            </div>
            <input
              type="text"
              id="home-nickname-input"
              className="input-large"
              placeholder="Введите никнейм..."
              maxLength={24}
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
            />
          </div>

          <div className="home-mode-selection">
            <span className="form-label" style={{ display: 'block', marginBottom: 8 }}>
              Выберите режим:
            </span>
            <div className="home-mode-pills">
              <button
                type="button"
                className={`btn-home-mode ${selectedMode === 'blitz' ? 'active' : ''}`}
                onClick={() => selectMode('blitz')}
              >
                <strong>Блиц 10</strong>
                <small>10 постов на очки</small>
              </button>
              <button
                type="button"
                className={`btn-home-mode ${selectedMode === 'survival' ? 'active' : ''}`}
                onClick={() => selectMode('survival')}
              >
                <strong>Выживание</strong>
                <small>50 раундов, 3 жизни</small>
              </button>
              <button
                type="button"
                className={`btn-home-mode ${selectedMode === 'practice' ? 'active' : ''}`}
                onClick={() => selectMode('practice')}
              >
                <strong>Свободный</strong>
                <small>100 раундов без таймера</small>
              </button>
            </div>
          </div>

          <button
            className="btn-hero-play"
            type="button"
            onClick={() => {
              soundFx.playClick();
              startQuiz();
            }}
          >
            Начать игру
          </button>
        </div>
      </div>

      <div className="home-actions-grid">
        <div
          className="home-action-box"
          role="button"
          tabIndex={0}
          onClick={() => {
            soundFx.playClick();
            openSuggestPost();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              soundFx.playClick();
              openSuggestPost();
            }
          }}
        >
          <div className="hab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <div className="hab-info">
            <strong>Предложить пост</strong>
            <p>Загрузите скриншот любимого поста для викторины</p>
          </div>
        </div>

        <Link href="/authors" className="home-action-box" onClick={() => soundFx.playClick()}>
          <div className="hab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <div className="hab-info">
            <strong>Авторы ИТД</strong>
            <p>Поиск авторов и предложение новых участников</p>
          </div>
        </Link>

        <Link href="/leaderboard" className="home-action-box" onClick={() => soundFx.playClick()}>
          <div className="hab-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
          </div>
          <div className="hab-info">
            <strong>Рейтинг игроков</strong>
            <p>Таблица рекордов и лучших серий ответов</p>
          </div>
        </Link>
      </div>
    </section>
  );
}
