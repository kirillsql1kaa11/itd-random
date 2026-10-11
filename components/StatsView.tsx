'use client';

import React, { useEffect, useState } from 'react';
import { UserStats } from '@/types';
import { BarChart3, Trophy, Flame, Target, Trash2, RotateCcw } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
            Личная статистика
          </h2>
          <p className="text-xs sm:text-sm text-white/50">
            История ваших игр на этом устройстве
          </p>
        </div>

        {stats.gamesPlayed > 0 && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#ef4444]/15 border border-white/10 hover:border-[#ef4444]/30 text-white/50 hover:text-[#ef4444] text-xs font-semibold transition-all cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Сбросить данные</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-5 rounded-2xl bg-[#121218] border border-white/10 text-center">
          <div className="w-9 h-9 rounded-xl bg-[#0080ff]/10 text-[#0080ff] flex items-center justify-center mx-auto mb-2.5">
            <BarChart3 size={20} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Игр сыграно</span>
          <strong className="font-heading font-extrabold text-2xl text-white">
            {stats.gamesPlayed}
          </strong>
        </div>

        <div className="p-5 rounded-2xl bg-[#121218] border border-white/10 text-center">
          <div className="w-9 h-9 rounded-xl bg-[#00ba7c]/10 text-[#00ba7c] flex items-center justify-center mx-auto mb-2.5">
            <Trophy size={20} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Рекорд</span>
          <strong className="font-heading font-extrabold text-2xl text-white">
            {stats.bestScore}
          </strong>
        </div>

        <div className="p-5 rounded-2xl bg-[#121218] border border-white/10 text-center">
          <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center mx-auto mb-2.5">
            <Flame size={20} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Макс. серия</span>
          <strong className="font-heading font-extrabold text-2xl text-white">
            {stats.maxStreak}
          </strong>
        </div>

        <div className="p-5 rounded-2xl bg-[#121218] border border-white/10 text-center">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-2.5">
            <Target size={20} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Точность</span>
          <strong className="font-heading font-extrabold text-2xl text-white">
            {avgAccuracy}%
          </strong>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-[#121218] border border-white/10 space-y-4">
        <h3 className="font-heading font-bold text-base text-white">
          Последние партии
        </h3>

        {stats.history.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-6">
            Вы еще не сыграли ни одной партии
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {stats.history.slice(-10).reverse().map((h, i) => (
              <div key={i} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <strong className="text-white block font-medium">
                    {h.mode === 'blitz' ? 'Блиц 10' : h.mode === 'survival' ? 'Выживание' : 'Свободный'}
                  </strong>
                  <span className="text-xs text-white/40">{h.date}</span>
                </div>
                <div className="text-right">
                  <span className="font-heading font-bold text-white text-base block">
                    {h.score} очков
                  </span>
                  <span className="text-xs text-[#00ba7c]">{h.accuracy}% точность</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
