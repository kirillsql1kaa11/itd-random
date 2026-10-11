'use client';

import React, { useState } from 'react';
import { soundFx } from '@/lib/sound';

interface SuggestAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_OPTIONS = [
  { label: 'Голубой неон', value: 'linear-gradient(135deg, #0288d1, #26c6da)' },
  { label: 'Фиолетово-розовый', value: 'linear-gradient(135deg, #7c3aed, #ec4899)' },
  { label: 'Огненный', value: 'linear-gradient(135deg, #ef4444, #f97316)' },
  { label: 'Изумрудный', value: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  { label: 'Янтарный', value: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { label: 'Индиго', value: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' },
  { label: 'Малиновый', value: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
  { label: 'Лаймовый', value: 'linear-gradient(135deg, #84cc16, #22c55e)' },
  { label: 'Морской', value: 'linear-gradient(135deg, #14b8a6, #3b82f6)' },
  { label: 'Закат', value: 'linear-gradient(135deg, #f97316, #facc15)' },
  { label: 'Лавандовый', value: 'linear-gradient(135deg, #a855f7, #6366f1)' },
  { label: 'Мятный', value: 'linear-gradient(135deg, #06b6d4, #22c55e)' },
  { label: 'Коралловый', value: 'linear-gradient(135deg, #f43f5e, #fb923c)' },
  { label: 'Графитовый', value: 'linear-gradient(135deg, #64748b, #0f172a)' },
  { label: 'Фуксия-золото', value: 'linear-gradient(135deg, #d946ef, #f59e0b)' },
  { label: 'Небесный', value: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
];

export function SuggestAuthorModal({ isOpen, onClose }: SuggestAuthorModalProps) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [badge, setBadge] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [profileUrl, setProfileUrl] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите имя автора');
      return;
    }

    setLoading(true);
    setError('');
    soundFx.playClick();

    const normalizedHandle = handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`;

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: name.trim(),
          post_text: `Новый автор: ${normalizedHandle} (${badge || 'Без бейджа'}). ${bio || ''}. Ссылка: ${profileUrl || ''}`,
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
          setBadge('');
          setProfileUrl('');
          setBio('');
          onClose();
        }, 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Ошибка при отправке автора');
      }
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      id="modal-suggest-author"
      style={{ zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ maxWidth: 520 }}>
        <button
          type="button"
          className="modal-close-btn"
          id="btn-close-suggest-author-modal"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="modal-title">Предложить автора ИТД</h2>
        <p className="modal-subtitle">
          Укажите данные автора из ИТД. После проверки администратором он появится в викторине.
        </p>

        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 8 }}>
              Заявка отправлена
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Автор будет проверен администратором.
            </p>
          </div>
        ) : (
          <form id="form-suggest-author" onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="suggest-author-name">
                Отображаемое имя *
              </label>
              <input
                type="text"
                id="suggest-author-name"
                required
                placeholder="Например: Шляпа Боярского"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="suggest-author-handle">
                Handle (@никнейм в ИТД)
              </label>
              <input
                type="text"
                id="suggest-author-handle"
                placeholder="@shlyapa"
                autoComplete="off"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="suggest-author-badge">
                Бейдж / титул
              </label>
              <input
                type="text"
                id="suggest-author-badge"
                placeholder="Топ-автор, Dev, Мемлорд..."
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="suggest-author-color">
                Цвет аватара
              </label>
              <select
                id="suggest-author-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="suggest-author-profile">
                Ссылка на профиль в ИТД
              </label>
              <input
                type="url"
                id="suggest-author-profile"
                placeholder="https://xn--d1ah4a.com/@shlyapa"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" htmlFor="suggest-author-bio">
                Стиль / био автора
              </label>
              <textarea
                id="suggest-author-bio"
                rows={2}
                placeholder="О чем обычно пишет этот автор..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ color: 'var(--accent-danger)', fontSize: 12, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary-action"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Отправка...' : 'Отправить автора на модерацию'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
