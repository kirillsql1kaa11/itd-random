'use client';

import React, { useEffect, useState } from 'react';
import { Author } from '@/types';
import { Search, UserPlus, BadgeCheck, Users } from 'lucide-react';
import { soundFx } from '@/lib/sound';

interface AuthorsViewProps {
  onOpenSuggestAuthor: () => void;
}

export function AuthorsView({ onOpenSuggestAuthor }: AuthorsViewProps) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadAuthors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/authors');
      const data = await res.json();
      if (data && data.ok) {
        setAuthors(data.authors || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuthors();
  }, []);

  const filtered = authors.filter((a) => {
    const q = search.toLowerCase();
    return (
      (a.name || '').toLowerCase().includes(q) ||
      (a.handle || '').toLowerCase().includes(q) ||
      (a.bio || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
            Авторы ИТД
          </h2>
          <p className="text-xs sm:text-sm text-white/50">
            Список создателей контента, чьи посты участвуют в викторине
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onOpenSuggestAuthor();
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white text-xs font-semibold transition-all cursor-pointer shadow-[0_0_15px_rgba(0,128,255,0.3)]"
        >
          <UserPlus size={16} />
          <span>Предложить автора</span>
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или никнейму..."
          className="w-full bg-[#121218] border border-white/10 focus:border-[#0080ff] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
        />
      </div>

      {loading ? (
        <div className="p-16 text-center text-white/50 text-sm">
          Загрузка каталога авторов...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 text-center text-white/50 text-sm">
          Авторы не найдены
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((author) => {
            const avatarColor = author.avatar_color || author.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)';
            const avatarText = author.avatar_text || author.avatarText || (author.name ? author.name[0] : '?');

            return (
              <div
                key={author.id}
                className="p-5 rounded-2xl bg-[#121218] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0 shadow-md"
                    style={{ background: avatarColor }}
                  >
                    {avatarText}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-sm font-semibold truncate text-white">
                        {author.name}
                      </strong>
                      {author.verified && (
                        <BadgeCheck size={15} className="text-[#0080ff] shrink-0" />
                      )}
                    </div>
                    <span className="block text-xs text-white/50 truncate">
                      {author.handle}
                    </span>
                  </div>
                </div>

                {author.bio && (
                  <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                    {author.bio}
                  </p>
                )}

                {author.badge && (
                  <div className="pt-2 border-t border-white/5">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-white/60">
                      {author.badge}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
