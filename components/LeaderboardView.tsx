'use client';

import React, { useEffect, useState } from 'react';
import { LeaderboardRecord } from '@/types';
import { Trophy, Flame, Target, Search, RefreshCw } from 'lucide-react';
import { soundFx } from '@/lib/sound';

export function LeaderboardView() {
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const url = filterMode === 'all' ? '/api/leaderboard' : `/api/leaderboard?mode=${filterMode}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.ok) {
        setRecords(data.leaderboard || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, [filterMode]);

  const filtered = records.filter((r) =>
    (r.nickname || '').toLowerCase().includes(search.toLowerCase())
  );

  const modeFilters = [
    { id: 'all', label: 'Все режимы' },
    { id: 'blitz', label: 'Блиц 10' },
    { id: 'survival', label: 'Выживание' },
    { id: 'practice', label: 'Свободный' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
            Рейтинг игроков
          </h2>
          <p className="text-xs sm:text-sm text-white/50">
            Лучшие скроллеры и знатоки постов сообщества ИТД
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            loadLeaderboard();
          }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14141c] hover:bg-[#1a1a24] border border-white/10 text-xs font-semibold text-white/70 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Обновить</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1.5 bg-[#121218] p-1 rounded-xl border border-white/10 overflow-x-auto">
          {modeFilters.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                soundFx.playClick();
                setFilterMode(m.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                filterMode === m.id
                  ? 'bg-[#0080ff] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по никнейму..."
            className="w-full bg-[#121218] border border-white/10 focus:border-[#0080ff] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/40 outline-none"
          />
        </div>
      </div>

      <div className="rounded-2xl bg-[#121218] border border-white/10 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-white/50 text-sm">
            Загрузка таблицы рекордов...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-white/50 text-sm">
            Записи рейтинга не найдены
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold text-white/40 uppercase bg-white/5">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Игрок</th>
                  <th className="py-3 px-4">Режим</th>
                  <th className="py-3 px-4 text-right">Очки</th>
                  <th className="py-3 px-4 text-right">Серия</th>
                  <th className="py-3 px-4 text-right">Точность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {filtered.map((item, idx) => {
                  const rank = idx + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;

                  return (
                    <tr key={item.id || idx} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] font-bold text-xs border border-[#f59e0b]/40">
                            1
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-300 font-bold text-xs border border-slate-300/40">
                            2
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 font-bold text-xs border border-amber-700/40">
                            3
                          </span>
                        ) : (
                          <span className="text-white/40 text-xs font-semibold">{rank}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <strong className="text-white font-semibold block">{item.nickname}</strong>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-white/50">
                        {item.mode === 'blitz' ? 'Блиц 10' : item.mode === 'survival' ? 'Выживание' : 'Свободный'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-heading font-bold text-white text-base">
                        {item.score}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-[#f59e0b] font-semibold">
                        x{item.streak}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-[#00ba7c] font-semibold">
                        {item.accuracy}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
