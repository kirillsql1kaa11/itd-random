'use client';

import React, { useState, useEffect } from 'react';
import { Author } from '@/types';
import { soundFx } from '@/lib/sound';
import { getAuthorsClient } from '@/lib/authors-client';

interface SuggestPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  nickname: string;
  onOpenSuggestAuthor: () => void;
}

export function SuggestPostModal({
  isOpen,
  onClose,
  nickname,
  onOpenSuggestAuthor,
}: SuggestPostModalProps) {
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [authorSearch, setAuthorSearch] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [authorsList, setAuthorsList] = useState<Author[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [postText, setPostText] = useState('');
  const [postHint, setPostHint] = useState('');
  const [postTags, setPostTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    getAuthorsClient()
      .then((authors) => setAuthorsList(authors))
      .catch(() => {});
  }, [isOpen]);

  const handleImageFile = (file: File) => {
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

  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredAuthors = authorsList.filter((a) => {
    const q = authorSearch.toLowerCase();
    return (
      (a.name || '').toLowerCase().includes(q) ||
      (a.handle || '').toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotData) {
      setError('Загрузите скриншот поста');
      return;
    }
    if (!selectedAuthor) {
      setError('Выберите правильного автора поста');
      return;
    }
    if (!postUrl.trim()) {
      setError('Укажите ссылку на пост в ИТД');
      return;
    }

    setLoading(true);
    setError('');
    soundFx.playClick();

    const tagList = postTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: selectedAuthor.id,
          author_name: selectedAuthor.name,
          screenshot: screenshotData,
          post_text: postText.trim(),
          submitted_by: nickname || 'Аноним',
          hint: postHint.trim(),
          tags: tagList,
          itd_url: postUrl.trim(),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setScreenshotData(null);
          setSelectedAuthor(null);
          setAuthorSearch('');
          setPostUrl('');
          setPostText('');
          setPostHint('');
          setPostTags('');
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
    <div className="modal-backdrop" id="modal-suggest-post" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal-card" style={{ maxWidth: 580 }}>
        <button
          type="button"
          className="modal-close-btn"
          id="btn-close-suggest-post"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="modal-title">Предложить пост для викторины</h2>
        <p className="modal-subtitle">
          Загрузите скриншот поста из ИТД, укажите автора и ссылку, и пост появится в игре после проверки.
        </p>

        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 8 }}>
              Предложение отправлено
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Спасибо! Пост будет проверен администратором.
            </p>
          </div>
        ) : (
          <form id="form-suggest-post" onSubmit={handleSubmit}>
            {!screenshotData ? (
              <div
                className="upload-dropzone"
                id="suggest-dropzone"
                style={{ marginBottom: 14 }}
                onClick={() => document.getElementById('suggest-file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
                }}
              >
                <div className="upload-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div className="upload-main-text">Нажмите для выбора файла или перетащите скриншот</div>
                <div className="upload-sub-text">PNG, JPG, WebP</div>
                <div className="clipboard-badge">Вставка через Ctrl + V из буфера обмена</div>
              </div>
            ) : (
              <div style={{ marginBottom: 14, textAlign: 'center' }}>
                <img
                  src={screenshotData}
                  alt="Скриншот"
                  style={{
                    maxHeight: 200,
                    maxWidth: '100%',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    display: 'block',
                    margin: '0 auto',
                  }}
                />
                <button
                  type="button"
                  className="btn-small-tool"
                  style={{ marginTop: 8 }}
                  onClick={() => setScreenshotData(null)}
                >
                  Заменить картинку
                </button>
              </div>
            )}

            <input
              type="file"
              id="suggest-file-input"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
              }}
            />

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Правильный автор поста * (поиск по имени или нику)</label>
              <div className="author-search-dropdown-wrapper">
                {!selectedAuthor ? (
                  <>
                    <input
                      type="text"
                      id="suggest-post-author-search"
                      placeholder="Начните вводить имя или @handle автора..."
                      autoComplete="off"
                      value={authorSearch}
                      onChange={(e) => {
                        setAuthorSearch(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                    />
                    {showDropdown && authorSearch && (
                      <div className="author-suggestions-dropdown">
                        {filteredAuthors.length === 0 ? (
                          <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                            Автор не найден
                          </div>
                        ) : (
                          filteredAuthors.slice(0, 6).map((a) => (
                            <div
                              key={a.id}
                              className="author-suggestion-item"
                              onClick={() => {
                                setSelectedAuthor(a);
                                setShowDropdown(false);
                                setAuthorSearch('');
                              }}
                            >
                              <div
                                className="asi-avatar"
                                style={{ background: a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)' }}
                              >
                                {a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?')}
                              </div>
                              <div className="asi-meta">
                                <div className="asi-name">{a.name}</div>
                                <div className="asi-handle">{a.handle}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="selected-author-pill">
                    <div
                      className="sap-avatar"
                      style={{ background: selectedAuthor.avatar_color || selectedAuthor.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)' }}
                    >
                      {selectedAuthor.avatar_text || selectedAuthor.avatarText || (selectedAuthor.name ? selectedAuthor.name[0] : '?')}
                    </div>
                    <span className="sap-name">{selectedAuthor.name}</span>
                    <span className="sap-handle">{selectedAuthor.handle}</span>
                    <button
                      type="button"
                      className="sap-remove-btn"
                      onClick={() => setSelectedAuthor(null)}
                      title="Удалить выбор"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Нет автора в списке?</span>
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={() => {
                    onOpenSuggestAuthor();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-blue)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  + Предложить нового автора
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="suggest-post-url">Ссылка на пост в ИТД *</label>
              <input
                type="url"
                id="suggest-post-url"
                required
                placeholder="https://xn--d1ah4a.com/post/..."
                autoComplete="off"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="suggest-post-text">Текст поста (необязательно, для поиска)</label>
              <textarea
                id="suggest-post-text"
                rows={2}
                placeholder="Краткое содержание или цитата из поста..."
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
            </div>

            <div className="form-grid" style={{ marginBottom: 18 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="suggest-post-hint">Подсказка для игроков</label>
                <input
                  type="text"
                  id="suggest-post-hint"
                  placeholder="Например: Автор часто пишет про деплой в пятницу"
                  value={postHint}
                  onChange={(e) => setPostHint(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="suggest-post-tags">Теги (через запятую)</label>
                <input
                  type="text"
                  id="suggest-post-tags"
                  placeholder="#итд, #щитпост, #жиза"
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                />
              </div>
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
              {loading ? 'Отправка...' : 'Отправить пост на модерацию'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
