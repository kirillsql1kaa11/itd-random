'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { soundFx } from '@/lib/sound';

interface SuggestAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SuggestAuthorModal({ isOpen, onClose }: SuggestAuthorModalProps) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    soundFx.playClick();

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: name.trim(),
          post_text: `Предложение нового автора: @${handle.replace('@', '')} (${bio})`,
          screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          submitted_by: 'Заявка на автора',
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setName('');
          setHandle('');
          setBio('');
          onClose();
        }, 1500);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#121218] border border-white/10 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-extrabold text-xl text-white">Предложить автора</h3>
            <p className="text-xs text-white/50">Добавьте автора для включения в викторину</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="py-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#00ba7c]/20 text-[#00ba7c] flex items-center justify-center mx-auto mb-2">
              <Check size={24} />
            </div>
            <strong className="text-base text-white block">Заявка отправлена</strong>
            <p className="text-xs text-white/50">Автор будет рассмотрен администратором</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">
                Имя автора
              </label>
              <input
                type="text"
                placeholder="Отображаемое имя..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#181822] border border-white/15 focus:border-[#0080ff] rounded-xl px-4 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">
                Никнейм / Handle
              </label>
              <input
                type="text"
                placeholder="@username в ИТД..."
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full bg-[#181822] border border-white/15 focus:border-[#0080ff] rounded-xl px-4 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">
                Описание / Био
              </label>
              <textarea
                rows={2}
                placeholder="Чем известен автор..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-[#181822] border border-white/15 focus:border-[#0080ff] rounded-xl px-4 py-2.5 text-xs text-white outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Отправка...' : 'Отправить автора'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
