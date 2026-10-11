'use client';

import React, { useState } from 'react';
import { X, Upload, Check, AlertCircle } from 'lucide-react';
import { soundFx } from '@/lib/sound';

interface SuggestPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
}

export function SuggestPostModal({ isOpen, onClose, nickname }: SuggestPostModalProps) {
  const [authorName, setAuthorName] = useState('');
  const [postText, setPostText] = useState('');
  const [submittedBy, setSubmittedBy] = useState(nickname || 'Аноним');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Выберите изображение (PNG, JPG, WebP)');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotData) {
      setError('Загрузите скриншот поста');
      return;
    }
    setLoading(true);
    setError('');
    soundFx.playClick();

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim() || 'Не указан',
          post_text: postText.trim(),
          screenshot: screenshotData,
          submitted_by: submittedBy.trim() || 'Аноним',
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setScreenshotData(null);
          setAuthorName('');
          setPostText('');
          onClose();
        }, 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Ошибка при отправке предложения');
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-[#121218] border border-white/10 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-extrabold text-xl text-white">Предложить пост</h3>
            <p className="text-xs text-white/50">Пост отправится на модерацию администратору</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#00ba7c]/20 text-[#00ba7c] flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <strong className="text-base text-white block">Предложение отправлено</strong>
            <p className="text-xs text-white/50">Спасибо за вклад в сообщество викторины</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">
                Автор поста
              </label>
              <input
                type="text"
                placeholder="Имя или @handle автора (если известно)..."
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-[#181822] border border-white/15 focus:border-[#0080ff] rounded-xl px-4 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">
                Текст поста (по желанию)
              </label>
              <textarea
                rows={2}
                placeholder="Текст поста для контекста..."
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                className="w-full bg-[#181822] border border-white/15 focus:border-[#0080ff] rounded-xl px-4 py-2.5 text-xs text-white outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 uppercase mb-1.5">
                Скриншот поста
              </label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                }}
                className="p-4 rounded-xl border border-dashed border-white/20 hover:border-[#0080ff] bg-[#181822] text-center cursor-pointer transition-colors"
                onClick={() => document.getElementById('suggest-file-input')?.click()}
              >
                <input
                  id="suggest-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                  }}
                />

                {screenshotData ? (
                  <div className="space-y-2">
                    <img src={screenshotData} alt="Превью" className="h-28 mx-auto object-contain rounded-lg" />
                    <span className="text-xs text-[#0080ff] font-medium block">Изображение выбрано (нажмите для смены)</span>
                  </div>
                ) : (
                  <div className="py-4 space-y-1">
                    <Upload size={24} className="mx-auto text-white/40" />
                    <span className="block text-xs font-medium text-white/80">Нажмите для выбора или перетащите файл</span>
                    <span className="block text-[11px] text-white/40">PNG, JPG, WebP до 2 МБ</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-[#ef4444] font-medium">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Отправка...' : 'Отправить предложение'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
