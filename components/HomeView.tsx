'use client';

import React from 'react';
import { GameMode } from '@/types';
import { generateRandomNickname } from '@/lib/utils';
import { soundFx } from '@/lib/sound';

interface HomeViewProps {
  nickname: string;
  onNicknameChange: (name: string) => void;
  selectedMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  onStartGame: () => void;
  onOpenSuggestPost: () => void;
  onOpenAuthors: () => void;
  onOpenLeaderboard: () => void;
}

export function HomeView({
  nickname,
  onNicknameChange,
  selectedMode,
  onModeChange,
  onStartGame,
  onOpenSuggestPost,
  onOpenAuthors,
  onOpenLeaderboard,
}: HomeViewProps) {
  const handleRandomizeNick = () => {
    soundFx.playClick();
    const newNick = generateRandomNickname();
    onNicknameChange(newNick);
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
              onChange={(e) => onNicknameChange(e.target.value)}
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
                onClick={() => {
                  soundFx.playClick();
                  onModeChange('blitz');
                }}
              >
                <strong>Блиц 10</strong>
                <small>10 постов на очки</small>
              </button>
              <button
                type="button"
                className={`btn-home-mode ${selectedMode === 'survival' ? 'active' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  onModeChange('survival');
                }}
              >
                <strong>Выживание</strong>
                <small>3 жизни, до первой ошибки</small>
              </button>
              <button
                type="button"
                className={`btn-home-mode ${selectedMode === 'practice' ? 'active' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  onModeChange('practice');
                }}
              >
                <strong>Свободный</strong>
                <small>Без таймера и жизней</small>
              </button>
            </div>
          </div>

          <button
            className="btn-hero-play"
            type="button"
            onClick={() => {
              soundFx.playClick();
              onStartGame();
            }}
          >
            Начать игру
          </button>
        </div>
      </div>

      <div className="home-actions-grid">
        <div
          className="home-action-box"
          onClick={() => {
            soundFx.playClick();
            onOpenSuggestPost();
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

        <div
          className="home-action-box"
          onClick={() => {
            soundFx.playClick();
            onOpenAuthors();
          }}
        >
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
        </div>

        <div
          className="home-action-box"
          onClick={() => {
            soundFx.playClick();
            onOpenLeaderboard();
          }}
        >
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
        </div>
      </div>
    </section>
  );
}
