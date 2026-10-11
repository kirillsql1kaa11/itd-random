'use client';

import React from 'react';
import { GameMode } from '@/types';
import { Dice5, Play, PlusCircle, Users, Trophy, Flame, ShieldAlert, Sparkles } from 'lucide-react';
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

  const modes: Array<{ id: GameMode; title: string; desc: string; icon: any }> = [
    { id: 'blitz', title: 'Блиц 10', desc: '10 постов на очки и время', icon: Flame },
    { id: 'survival', title: 'Выживание', desc: '3 жизни до первой ошибки', icon: ShieldAlert },
    { id: 'practice', title: 'Свободный', desc: 'Без таймера и штрафов', icon: Sparkles },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#16161f] to-[#111116] border border-white/10 p-6 md:p-10 shadow-2xl">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#0080ff]/15 text-[#0080ff] border border-[#0080ff]/30 mb-4">
            Викторина по соцсети ИТД
          </span>

          <h1 className="font-heading font-extrabold text-3xl md:text-5xl text-white tracking-tight leading-tight mb-4">
            Угадай, кто написал пост
          </h1>

          <p className="text-white/60 text-sm md:text-base leading-relaxed mb-8">
            Определяй авторов по скриншотам постов, стилю текста и юмору. Соревнуйся с другими скроллерами и поднимайся в таблице рекордов.
          </p>

          <div className="space-y-6 bg-[#181822]/80 backdrop-blur border border-white/10 p-5 md:p-7 rounded-2xl">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="nick-input" className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Ваш игровой никнейм
                </label>
                <button
                  type="button"
                  onClick={handleRandomizeNick}
                  className="flex items-center gap-1.5 text-xs text-[#0080ff] hover:text-[#3399ff] transition-colors cursor-pointer"
                >
                  <Dice5 size={14} />
                  <span>Случайный ник</span>
                </button>
              </div>
              <input
                id="nick-input"
                type="text"
                value={nickname}
                onChange={(e) => onNicknameChange(e.target.value)}
                maxLength={24}
                placeholder="Введите никнейм..."
                className="w-full bg-[#101015] border border-white/15 focus:border-[#0080ff] focus:ring-2 focus:ring-[#0080ff]/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-base outline-none transition-all"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2.5">
                Режим игры
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {modes.map((m) => {
                  const Icon = m.icon;
                  const isSelected = selectedMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        onModeChange(m.id);
                      }}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0080ff]/15 border-[#0080ff] shadow-[0_0_15px_rgba(0,128,255,0.25)]'
                          : 'bg-[#101015] border-white/10 hover:border-white/20 text-white/70 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={16} className={isSelected ? 'text-[#0080ff]' : 'text-white/50'} />
                        <strong className="text-sm font-semibold text-white">{m.title}</strong>
                      </div>
                      <p className="text-[11px] text-white/50 leading-tight">{m.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onStartGame();
              }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#0080ff] to-[#0066cc] hover:from-[#1a8cff] hover:to-[#0073e6] text-white font-heading font-bold text-base md:text-lg tracking-wide shadow-[0_0_25px_rgba(0,128,255,0.4)] hover:shadow-[0_0_35px_rgba(0,128,255,0.6)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Play size={20} fill="currentColor" />
              <span>Начать игру</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onOpenSuggestPost();
          }}
          className="text-left p-5 rounded-2xl bg-[#121217] border border-white/10 hover:border-white/25 hover:bg-[#16161e] transition-all cursor-pointer flex items-start gap-4 group"
        >
          <div className="p-3 rounded-xl bg-[#0080ff]/10 text-[#0080ff] group-hover:scale-105 transition-transform">
            <PlusCircle size={24} />
          </div>
          <div>
            <strong className="block text-white font-semibold text-base mb-1">Предложить пост</strong>
            <p className="text-white/50 text-xs leading-relaxed">
              Загрузите скриншот любимого поста ИТД для добавления в викторину
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onOpenAuthors();
          }}
          className="text-left p-5 rounded-2xl bg-[#121217] border border-white/10 hover:border-white/25 hover:bg-[#16161e] transition-all cursor-pointer flex items-start gap-4 group"
        >
          <div className="p-3 rounded-xl bg-[#00ba7c]/10 text-[#00ba7c] group-hover:scale-105 transition-transform">
            <Users size={24} />
          </div>
          <div>
            <strong className="block text-white font-semibold text-base mb-1">Авторы ИТД</strong>
            <p className="text-white/50 text-xs leading-relaxed">
              Каталог авторов, статистика постов и предложение новых участников
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onOpenLeaderboard();
          }}
          className="text-left p-5 rounded-2xl bg-[#121217] border border-white/10 hover:border-white/25 hover:bg-[#16161e] transition-all cursor-pointer flex items-start gap-4 group"
        >
          <div className="p-3 rounded-xl bg-[#f59e0b]/10 text-[#f59e0b] group-hover:scale-105 transition-transform">
            <Trophy size={24} />
          </div>
          <div>
            <strong className="block text-white font-semibold text-base mb-1">Рейтинг игроков</strong>
            <p className="text-white/50 text-xs leading-relaxed">
              Таблица лидеров по очкам, сериям верных ответов и точности
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
