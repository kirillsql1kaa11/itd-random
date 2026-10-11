'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Author } from '@/types';
import { soundFx } from '@/lib/sound';

interface AdminViewProps {
  onGoHome: () => void;
}

export function AdminView({ onGoHome }: AdminViewProps) {
  const [token, setToken] = useState<string | null>(null);
  const [pinPassword, setPinPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [posts, setPosts] = useState<any[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const [itdUrl, setItdUrl] = useState('');
  const [itdToken, setItdToken] = useState('');
  const [itdLoading, setItdLoading] = useState(false);

  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [censorTool, setCensorTool] = useState<'blackout' | 'blur'>('blackout');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const [authorSearch, setAuthorSearch] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [postText, setPostText] = useState('');
  const [postHint, setPostHint] = useState('');
  const [postTags, setPostTags] = useState('');
  const [postDiff, setPostDiff] = useState('normal');
  const [isSavingPost, setIsSavingPost] = useState(false);

  const [postsSearch, setPostsSearch] = useState('');
  const [postsPage, setPostsPage] = useState(1);
  const postsPerPage = 10;

  const [authorsSearch, setAuthorsSearch] = useState('');
  const [authorsPage, setAuthorsPage] = useState(1);
  const authorsPerPage = 10;

  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const [showNewAuthorModal, setShowNewAuthorModal] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newAuthorHandle, setNewAuthorHandle] = useState('');
  const [newAuthorBadge, setNewAuthorBadge] = useState('');
  const [newAuthorColor, setNewAuthorColor] = useState('linear-gradient(135deg, #0288d1, #26c6da)');
  const [newAuthorBio, setNewAuthorBio] = useState('');
  const [newAuthorVerified, setNewAuthorVerified] = useState(true);

  useEffect(() => {
    const savedToken = sessionStorage.getItem('itd_admin_token');
    if (savedToken) {
      setToken(savedToken);
      loadAdminData(savedToken);
    }
    const savedItdToken = localStorage.getItem('itd_import_token');
    if (savedItdToken) setItdToken(savedItdToken);
  }, []);

  const loadAdminData = async (authToken: string) => {
    try {
      const [resPosts, resAuthors, resSug] = await Promise.all([
        fetch('/api/admin?action=get_posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/admin?action=get_authors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/admin?action=get_suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const [dataPosts, dataAuthors, dataSug] = await Promise.all([
        resPosts.json(),
        resAuthors.json(),
        resSug.json(),
      ]);

      if (dataPosts.ok) setPosts(dataPosts.posts || []);
      if (dataAuthors.ok) setAuthors(dataAuthors.authors || []);
      if (dataSug.ok) setSuggestions(dataSug.suggestions || []);
    } catch {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinPassword) return;
    setIsLoggingIn(true);
    setLoginError('');
    soundFx.playClick();

    try {
      const res = await fetch('/api/admin?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pinPassword }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        sessionStorage.setItem('itd_admin_token', data.token);
        setPinPassword('');
        loadAdminData(data.token);
      } else {
        setLoginError(data.error || 'Неверный пароль');
      }
    } catch {
      setLoginError('Ошибка подключения к серверу');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    soundFx.playClick();
    sessionStorage.removeItem('itd_admin_token');
    setToken(null);
    onGoHome();
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      initCanvasWithImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!token) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [token]);

  const initCanvasWithImage = (dataUrl: string) => {
    setScreenshotData(dataUrl);
    setCanvasHistory([]);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      setCanvasHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    };
    img.src = dataUrl;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setIsDrawing(true);
    setStartPos({ x, y });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const endX = (e.clientX - rect.left) * scaleX;
    const endY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(startPos.x, endX);
    const y = Math.min(startPos.y, endY);
    const w = Math.abs(endX - startPos.x);
    const h = Math.abs(endY - startPos.y);

    if (w > 4 && h > 4) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (censorTool === 'blackout') {
          ctx.fillStyle = '#16161a';
          ctx.fillRect(x, y, w, h);
        } else {
          ctx.filter = 'blur(10px)';
          ctx.drawImage(canvas, x, y, w, h, x, y, w, h);
          ctx.filter = 'none';
        }
        setCanvasHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
      }
    }

    setIsDrawing(false);
    setStartPos(null);
  };

  const handleUndoCensor = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvasHistory.length <= 1) return;
    const nextHist = canvasHistory.slice(0, -1);
    const last = nextHist[nextHist.length - 1];
    const ctx = canvas.getContext('2d');
    if (ctx && last) {
      ctx.putImageData(last, 0, 0);
      setCanvasHistory(nextHist);
    }
  };

  const handleItdImport = async () => {
    if (!itdUrl) {
      alert('Вставьте ссылку на пост ИТД');
      return;
    }
    if (!itdToken) {
      alert('Укажите токен авторизации ИТД');
      return;
    }
    localStorage.setItem('itd_import_token', itdToken);
    setItdLoading(true);

    try {
      const res = await fetch('/api/admin?action=fetch_itd_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: itdUrl, itdToken }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        const p = data.post;
        if (p.screenshot) initCanvasWithImage(p.screenshot);
        if (p.text) setPostText(p.text);

        const match = authors.find(
          (a) => (a.handle || '').toLowerCase() === (p.authorHandle || '').toLowerCase()
        );
        if (match) {
          setSelectedAuthor(match);
        } else if (p.authorHandle) {
          const autoAuthor: Author = {
            id: (p.authorHandle || '').replace('@', '').toLowerCase() || `author_${Date.now()}`,
            name: p.authorName || p.authorHandle,
            handle: p.authorHandle,
            badge: 'Автор ИТД',
            verified: true,
            avatarColor: 'linear-gradient(135deg, #0288d1, #26c6da)',
            avatarText: (p.authorName || 'A')[0],
          };
          setSelectedAuthor(autoAuthor);
        }
      } else {
        alert(data.error || 'Не удалось импортировать пост');
      }
    } catch {
      alert('Ошибка при импорте из ИТД');
    } finally {
      setItdLoading(false);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const finalScreenshot = canvas ? canvas.toDataURL('image/jpeg', 0.9) : screenshotData;

    if (!finalScreenshot) {
      alert('Загрузите скриншот поста');
      return;
    }
    if (!selectedAuthor) {
      alert('Выберите автора поста');
      return;
    }

    setIsSavingPost(true);
    soundFx.playClick();

    const tagList = postTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const postPayload = {
      id: `post_${Date.now()}`,
      correctAuthorId: selectedAuthor.id,
      postText: postText.trim(),
      screenshot: finalScreenshot,
      hint: postHint.trim(),
      difficulty: postDiff,
      tags: tagList.length > 0 ? tagList : ['#итд'],
    };

    try {
      const res = await fetch('/api/admin?action=save_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ post: postPayload }),
      });
      if (res.ok) {
        alert('Пост успешно добавлен в базу викторины!');
        setScreenshotData(null);
        setSelectedAuthor(null);
        setPostText('');
        setPostHint('');
        setPostTags('');
        setItdUrl('');
        loadAdminData(token!);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Ошибка при сохранении поста');
      }
    } catch {
      alert('Ошибка соединения');
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Удалить этот вопрос?')) return;
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=delete_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {}
  };

  const handleModerateSuggestion = async (id: string, status: 'approved' | 'rejected', postRecord?: any) => {
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=moderate_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status, postRecord }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
        if (status === 'approved') loadAdminData(token!);
      }
    } catch {}
  };

  const handleSaveAuthorModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthorName.trim()) return;
    soundFx.playClick();

    const authorPayload: Author = {
      id: newAuthorHandle.replace('@', '').toLowerCase() || `author_${Date.now()}`,
      name: newAuthorName.trim(),
      handle: newAuthorHandle.startsWith('@') ? newAuthorHandle : `@${newAuthorHandle}`,
      badge: newAuthorBadge.trim() || null,
      avatarColor: newAuthorColor,
      avatarText: newAuthorName.trim()[0] || '?',
      bio: newAuthorBio.trim() || null,
      verified: newAuthorVerified,
    };

    try {
      const res = await fetch('/api/admin?action=save_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ author: authorPayload }),
      });
      if (res.ok) {
        setShowNewAuthorModal(false);
        setNewAuthorName('');
        setNewAuthorHandle('');
        setNewAuthorBadge('');
        setNewAuthorBio('');
        loadAdminData(token!);
      }
    } catch {}
  };

  const handleDeleteAuthor = async (id: string) => {
    if (!window.confirm('Удалить автора?')) return;
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=delete_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAuthors((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {}
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    soundFx.playClick();
    setPasswordMsg('');

    try {
      const res = await fetch('/api/admin?action=change_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg('Пароль успешно обновлен');
        if (data.token) {
          setToken(data.token);
          sessionStorage.setItem('itd_admin_token', data.token);
        }
        setNewPassword('');
      } else {
        setPasswordMsg(data.error || 'Ошибка при смене пароля');
      }
    } catch {
      setPasswordMsg('Ошибка соединения');
    }
  };

  if (!token) {
    return (
      <div className="modal-backdrop" id="modal-admin-pin" style={{ display: 'flex' }}>
        <div className="modal-card">
          <button className="modal-close-btn" id="btn-close-pin-modal" onClick={onGoHome}>
            ✕
          </button>
          <h2 className="modal-title">Вход в панель управления</h2>
          <p className="modal-subtitle">Введите пароль администратора для доступа</p>
          <form id="form-admin-pin" onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <input
                type="password"
                id="admin-pin-input"
                placeholder="••••••••"
                autoFocus
                style={{ textAlign: 'center', fontSize: 18, letterSpacing: 2 }}
                value={pinPassword}
                onChange={(e) => setPinPassword(e.target.value)}
              />
            </div>
            {loginError && (
              <div style={{ color: 'var(--accent-danger)', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
                {loginError}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary-action"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Проверка...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredPosts = posts.filter((p) => {
    const q = postsSearch.toLowerCase();
    const a = authors.find((auth) => auth.id === p.correct_author_id);
    return (
      (p.post_text || '').toLowerCase().includes(q) ||
      (p.hint || '').toLowerCase().includes(q) ||
      (a?.name || '').toLowerCase().includes(q) ||
      (a?.handle || '').toLowerCase().includes(q)
    );
  });

  const totalPostsPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));
  const paginatedPosts = filteredPosts.slice(
    (postsPage - 1) * postsPerPage,
    postsPage * postsPerPage
  );

  const filteredAuthors = authors.filter((a) => {
    const q = authorsSearch.toLowerCase();
    return (
      (a.name || '').toLowerCase().includes(q) ||
      (a.handle || '').toLowerCase().includes(q)
    );
  });

  const totalAuthorsPages = Math.max(1, Math.ceil(filteredAuthors.length / authorsPerPage));
  const paginatedAuthors = filteredAuthors.slice(
    (authorsPage - 1) * authorsPerPage,
    authorsPage * authorsPerPage
  );

  return (
    <section className="app-view">
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Панель управления викториной</h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ИТД · Кто автор?</span>
        </div>
        <div className="admin-header-actions">
          <span className="admin-badge-count">{posts.length} вопросов</span>
          <span className="admin-badge-count">{authors.length} авторов</span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Создать новый вопрос викторины</span>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label" htmlFor="admin-itd-url">
            Вставить ссылку на пост в ИТД (автозаполнение)
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="url"
              id="admin-itd-url"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="https://итд.com/@автор/post/..."
              autoComplete="off"
              value={itdUrl}
              onChange={(e) => setItdUrl(e.target.value)}
            />
            <button
              type="button"
              className="btn-small-tool"
              id="btn-itd-import"
              onClick={handleItdImport}
              disabled={itdLoading}
            >
              {itdLoading ? 'Загрузка...' : 'Заполнить по ссылке'}
            </button>
          </div>
          <input
            type="password"
            id="admin-itd-token"
            style={{ marginTop: 8 }}
            placeholder="Токен авторизации ИТД (хранится только в этом браузере)"
            autoComplete="off"
            value={itdToken}
            onChange={(e) => setItdToken(e.target.value)}
          />
        </div>

        {!screenshotData ? (
          <div
            className="upload-dropzone"
            id="admin-dropzone"
            onClick={() => document.getElementById('admin-file-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
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
          <div className="censor-preview-wrapper" id="admin-preview-container">
            <div className="censor-toolbar">
              <div className="censor-tools-group">
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>Инструмент:</span>
                <label className="censor-tool-label">
                  <input
                    type="radio"
                    name="censor-tool"
                    value="blackout"
                    checked={censorTool === 'blackout'}
                    onChange={() => setCensorTool('blackout')}
                  />
                  <span>Замазать ник (плашка)</span>
                </label>
                <label className="censor-tool-label">
                  <input
                    type="radio"
                    name="censor-tool"
                    value="blur"
                    checked={censorTool === 'blur'}
                    onChange={() => setCensorTool('blur')}
                  />
                  <span>Размытие</span>
                </label>
              </div>
              <div className="censor-actions-group">
                <button
                  type="button"
                  className="btn-small-tool"
                  id="btn-undo-censor"
                  onClick={handleUndoCensor}
                >
                  Отменить
                </button>
                <button
                  type="button"
                  className="btn-small-tool"
                  id="btn-change-screenshot"
                  onClick={() => setScreenshotData(null)}
                >
                  Заменить картинку
                </button>
              </div>
            </div>

            <div className="canvas-container" title="Выделите область с ником автора, чтобы скрыть его">
              <canvas
                id="censor-canvas"
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
              ></canvas>
            </div>
          </div>
        )}

        <input
          type="file"
          id="admin-file-input"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />

        <form id="admin-post-form" onSubmit={handleSavePost}>
          <div className="form-grid">
            <div className="form-group col-span-2">
              <label className="form-label">Правильный автор поста * (поиск по имени или нику)</label>
              <div className="author-search-dropdown-wrapper">
                {!selectedAuthor ? (
                  <>
                    <input
                      type="text"
                      id="admin-post-author-search"
                      placeholder="Начните вводить имя или @handle автора..."
                      autoComplete="off"
                      value={authorSearch}
                      onChange={(e) => {
                        setAuthorSearch(e.target.value);
                        setShowAuthorDropdown(true);
                      }}
                      onFocus={() => setShowAuthorDropdown(true)}
                    />
                    {showAuthorDropdown && authorSearch && (
                      <div className="author-suggestions-dropdown" id="admin-author-suggestions">
                        {authors
                          .filter((a) => {
                            const q = authorSearch.toLowerCase();
                            return (
                              (a.name || '').toLowerCase().includes(q) ||
                              (a.handle || '').toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 8)
                          .map((a) => (
                            <div
                              key={a.id}
                              className="author-suggestion-item"
                              onClick={() => {
                                setSelectedAuthor(a);
                                setShowAuthorDropdown(false);
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
                          ))}
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
            </div>

            <div className="form-group col-span-2">
              <label className="form-label" htmlFor="admin-post-text">Текст поста (необязательно, для поиска)</label>
              <textarea
                id="admin-post-text"
                rows={2}
                placeholder="Краткое содержание или цитата из поста..."
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-post-hint">Подсказка для игроков</label>
              <input
                type="text"
                id="admin-post-hint"
                placeholder="Например: Автор часто пишет про деплой в пятницу"
                value={postHint}
                onChange={(e) => setPostHint(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-post-tags">Теги (через запятую)</label>
              <input
                type="text"
                id="admin-post-tags"
                placeholder="#итд, #щитпост, #жиза"
                value={postTags}
                onChange={(e) => setPostTags(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-post-diff">Сложность вопроса</label>
              <select
                id="admin-post-diff"
                value={postDiff}
                onChange={(e) => setPostDiff(e.target.value)}
              >
                <option value="easy">Легкая (Узнаваемый стиль)</option>
                <option value="normal">Средняя (Для знатоков)</option>
                <option value="hard">Хардкор (Редкий пост)</option>
              </select>
            </div>
          </div>

          <div className="form-actions-row">
            <button
              type="button"
              className="btn-secondary-action"
              id="btn-admin-reset-form"
              onClick={() => {
                setScreenshotData(null);
                setSelectedAuthor(null);
                setPostText('');
                setPostHint('');
                setPostTags('');
              }}
            >
              Очистить
            </button>
            <button
              type="submit"
              className="btn-primary-action"
              id="btn-admin-submit"
              disabled={isSavingPost}
            >
              {isSavingPost ? 'Сохранение...' : 'Добавить в викторину'}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Вопросы в базе</span>
        </div>

        <div className="admin-filter-bar">
          <input
            type="text"
            id="admin-posts-search-input"
            className="search-input"
            placeholder="Поиск вопросов по автору, тексту или подсказке..."
            value={postsSearch}
            onChange={(e) => {
              setPostsSearch(e.target.value);
              setPostsPage(1);
            }}
          />
        </div>

        <div className="table-responsive admin-table-scroll-container">
          <table className="admin-posts-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Превью</th>
                <th>Правильный автор</th>
                <th>Текст поста</th>
                <th style={{ width: 80, textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPosts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">Вопросы не найдены</td>
                </tr>
              ) : (
                paginatedPosts.map((p) => {
                  const author = authors.find((a) => a.id === p.correct_author_id);
                  return (
                    <tr key={p.id}>
                      <td>
                        {p.screenshot && (
                          <img src={p.screenshot} alt="Превью" className="post-table-thumb" />
                        )}
                      </td>
                      <td>
                        <div className="table-author-cell">
                          <strong>{author?.name || p.correct_author_id}</strong>
                          <small>{author?.handle || ''}</small>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {p.post_text || 'Скриншот поста'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} className="col-actions">
                        <button
                          type="button"
                          className="btn-action-icon"
                          title="Удалить"
                          onClick={() => handleDeletePost(p.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-pagination-bar" id="admin-posts-pagination">
          <div className="admin-pagination-info" id="admin-posts-page-info">
            {filteredPosts.length > 0
              ? `Показано ${(postsPage - 1) * postsPerPage + 1}-${Math.min(postsPage * postsPerPage, filteredPosts.length)} из ${filteredPosts.length} постов`
              : '0 постов'}
          </div>
          <div className="admin-pagination-controls">
            <button
              type="button"
              className="btn-page-nav"
              disabled={postsPage <= 1}
              onClick={() => setPostsPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </button>
            <span className="admin-page-number">
              {postsPage} / {totalPostsPages}
            </span>
            <button
              type="button"
              className="btn-page-nav"
              disabled={postsPage >= totalPostsPages}
              onClick={() => setPostsPage((p) => Math.min(totalPostsPages, p + 1))}
            >
              Вперед →
            </button>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Заявки на посты ({suggestions.length})</span>
        </div>

        {suggestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Новых предложений нет
          </div>
        ) : (
          <div className="admin-suggestions-container">
            {suggestions.map((s) => (
              <div key={s.id} className="admin-suggestion-card">
                {s.screenshot && (
                  <img src={s.screenshot} alt="Скриншот" className="asc-thumb" />
                )}
                <div className="asc-info">
                  <div className="asc-author-line">Автор: {s.author_name}</div>
                  <div className="asc-meta-line">Предложил: {s.submitted_by}</div>
                  <div className="asc-comment">{s.post_text || 'Без описания'}</div>
                  <div className="asc-actions">
                    <button
                      type="button"
                      className="btn-approve"
                      onClick={() =>
                        handleModerateSuggestion(s.id, 'approved', {
                          correctAuthorId: s.author_id || s.author_name,
                          screenshot: s.screenshot,
                          postText: s.post_text,
                        })
                      }
                    >
                      Одобрить в базу
                    </button>
                    <button
                      type="button"
                      className="btn-reject"
                      onClick={() => handleModerateSuggestion(s.id, 'rejected')}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Пул авторов ИТД</span>
          <button
            type="button"
            className="btn-primary-action"
            style={{ fontSize: 12, padding: '6px 16px' }}
            onClick={() => setShowNewAuthorModal(true)}
          >
            + Добавить автора
          </button>
        </div>

        <div className="admin-filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Поиск авторов по имени или @handle..."
            value={authorsSearch}
            onChange={(e) => {
              setAuthorsSearch(e.target.value);
              setAuthorsPage(1);
            }}
          />
        </div>

        <div className="admin-authors-list admin-authors-scroll-container">
          {paginatedAuthors.map((a) => (
            <div key={a.id} className="admin-author-item">
              <div
                className="aai-avatar"
                style={{ background: a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)' }}
              >
                {a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?')}
              </div>
              <div className="aai-info">
                <div className="aai-name-row">
                  <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{a.name}</strong>
                  {a.badge && <span className="badge-tag">{a.badge}</span>}
                </div>
                <span className="aai-handle">{a.handle}</span>
                {a.bio && <div className="aai-bio">{a.bio}</div>}
              </div>
              <div className="aai-actions">
                <button
                  type="button"
                  className="btn-del-author"
                  onClick={() => handleDeleteAuthor(a.id)}
                  title="Удалить автора"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="admin-pagination-bar" id="admin-authors-pagination">
          <div className="admin-pagination-info" id="admin-authors-page-info">
            {filteredAuthors.length} авторов
          </div>
          <div className="admin-pagination-controls">
            <button
              type="button"
              className="btn-page-nav"
              disabled={authorsPage <= 1}
              onClick={() => setAuthorsPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </button>
            <span className="admin-page-number">
              {authorsPage} / {totalAuthorsPages}
            </span>
            <button
              type="button"
              className="btn-page-nav"
              disabled={authorsPage >= totalAuthorsPages}
              onClick={() => setAuthorsPage((p) => Math.min(totalAuthorsPages, p + 1))}
            >
              Вперед →
            </button>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Безопасность панели управления</span>
        </div>
        <form id="form-change-admin-password" style={{ maxWidth: 420 }} onSubmit={handleChangePassword}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label" htmlFor="new-admin-password-input">
              Новый пароль администратора
            </label>
            <input
              type="password"
              id="new-admin-password-input"
              placeholder="Введите новый надежный пароль..."
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {passwordMsg && (
            <div style={{ color: 'var(--accent-green)', fontSize: 12, marginBottom: 8 }}>
              {passwordMsg}
            </div>
          )}
          <button type="submit" className="btn-primary-action" style={{ fontSize: 12, padding: '8px 16px' }}>
            Обновить пароль
          </button>
        </form>
      </div>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 12 }}>
        <button type="button" className="btn-secondary-action" onClick={onGoHome}>
          ← Вернуться на главную
        </button>
        <button type="button" className="btn-danger-outline" onClick={handleLogout}>
          Выйти из панели управления
        </button>
      </div>

      {showNewAuthorModal && (
        <div className="modal-backdrop" id="modal-new-author" style={{ display: 'flex' }}>
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <button className="modal-close-btn" onClick={() => setShowNewAuthorModal(false)}>
              ✕
            </button>
            <h2 className="modal-title">Добавить автора в базу</h2>
            <form id="form-add-author" onSubmit={handleSaveAuthorModal}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Отображаемое имя *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Шляпа Боярского"
                  value={newAuthorName}
                  onChange={(e) => setNewAuthorName(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Handle (@никнейм)</label>
                <input
                  type="text"
                  placeholder="@shlyapa"
                  value={newAuthorHandle}
                  onChange={(e) => setNewAuthorHandle(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Бейдж / титул</label>
                <input
                  type="text"
                  placeholder="Топ-автор, Dev, Основатель..."
                  value={newAuthorBadge}
                  onChange={(e) => setNewAuthorBadge(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Цвет аватара</label>
                <select
                  value={newAuthorColor}
                  onChange={(e) => setNewAuthorColor(e.target.value)}
                >
                  <option value="linear-gradient(135deg, #0288d1, #26c6da)">Голубой неон</option>
                  <option value="linear-gradient(135deg, #7c3aed, #ec4899)">Фиолетово-розовый</option>
                  <option value="linear-gradient(135deg, #ef4444, #f97316)">Огненный</option>
                  <option value="linear-gradient(135deg, #10b981, #06b6d4)">Изумрудный</option>
                  <option value="linear-gradient(135deg, #f59e0b, #ef4444)">Янтарный</option>
                  <option value="linear-gradient(135deg, #3b82f6, #8b5cf6)">Индиго</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Стиль / био автора</label>
                <textarea
                  rows={2}
                  placeholder="О чем обычно пишет этот автор..."
                  value={newAuthorBio}
                  onChange={(e) => setNewAuthorBio(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="verified-check"
                  checked={newAuthorVerified}
                  onChange={(e) => setNewAuthorVerified(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="verified-check" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Галочка верификации
                </label>
              </div>
              <button type="submit" className="btn-primary-action" style={{ width: '100%', justifyContent: 'center' }}>
                Сохранить автора
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
