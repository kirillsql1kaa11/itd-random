'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Key, Plus, Trash2, Check, X, Download, Lock, LogOut, RefreshCw, ExternalLink } from 'lucide-react';
import { Author } from '@/types';
import { soundFx } from '@/lib/sound';

export function AdminView() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'authors' | 'suggestions' | 'itd' | 'password'>('posts');

  const [posts, setPosts] = useState<any[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [itdUrl, setItdUrl] = useState('');
  const [itdToken, setItdToken] = useState('');
  const [itdLoading, setItdLoading] = useState(false);
  const [itdResult, setItdResult] = useState<any | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const [newAuthorName, setNewAuthorName] = useState('');
  const [newAuthorHandle, setNewAuthorHandle] = useState('');
  const [newAuthorColor, setNewAuthorColor] = useState('linear-gradient(135deg, #0288d1, #26c6da)');
  const [newAuthorBio, setNewAuthorBio] = useState('');

  useEffect(() => {
    const savedToken = sessionStorage.getItem('itd_admin_token');
    if (savedToken) {
      setToken(savedToken);
      loadAdminData(savedToken);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsLoggingIn(true);
    setLoginError('');
    soundFx.playClick();

    try {
      const res = await fetch('/api/admin?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        sessionStorage.setItem('itd_admin_token', data.token);
        setPassword('');
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
  };

  const loadAdminData = async (authToken: string) => {
    setLoadingData(true);
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
    } catch {
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!token || !window.confirm('Удалить этот пост?')) return;
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

  const handleSaveAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newAuthorName.trim()) return;
    soundFx.playClick();

    const authorPayload = {
      id: newAuthorHandle.replace('@', '').toLowerCase() || `author_${Date.now()}`,
      name: newAuthorName.trim(),
      handle: newAuthorHandle.startsWith('@') ? newAuthorHandle : `@${newAuthorHandle}`,
      avatarColor: newAuthorColor,
      avatarText: newAuthorName.trim()[0] || '?',
      bio: newAuthorBio.trim(),
      verified: true,
    };

    try {
      const res = await fetch('/api/admin?action=save_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ author: authorPayload }),
      });
      if (res.ok) {
        setAuthors((prev) => [...prev, authorPayload]);
        setNewAuthorName('');
        setNewAuthorHandle('');
        setNewAuthorBio('');
      }
    } catch {}
  };

  const handleDeleteAuthor = async (id: string) => {
    if (!token || !window.confirm('Удалить автора?')) return;
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

  const handleModerateSuggestion = async (id: string, status: 'approved' | 'rejected', postRecord?: any) => {
    if (!token) return;
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=moderate_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status, postRecord }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
        if (status === 'approved') loadAdminData(token);
      }
    } catch {}
  };

  const handleFetchItd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !itdUrl) return;
    setItdLoading(true);
    setItdResult(null);
    soundFx.playClick();

    try {
      const res = await fetch('/api/admin?action=fetch_itd_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: itdUrl, itdToken }),
      });
      const data = await res.json();
      if (res.ok && data.post) {
        setItdResult(data.post);
      } else {
        alert(data.error || 'Ошибка загрузки поста из ИТД');
      }
    } catch {
      alert('Ошибка соединения');
    } finally {
      setItdLoading(false);
    }
  };

  const handleSaveItdPost = async () => {
    if (!token || !itdResult) return;
    soundFx.playClick();

    let targetAuthor = authors.find(
      (a) => (a.handle || '').toLowerCase() === (itdResult.authorHandle || '').toLowerCase()
    );

    if (!targetAuthor) {
      targetAuthor = {
        id: (itdResult.authorHandle || '').replace('@', '').toLowerCase() || `author_${Date.now()}`,
        name: itdResult.authorName || 'Автор ИТД',
        handle: itdResult.authorHandle || '@itd_user',
        avatarColor: 'linear-gradient(135deg, #0288d1, #26c6da)',
        avatarText: (itdResult.authorName || 'A')[0],
        verified: true,
      };
      await fetch('/api/admin?action=save_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ author: targetAuthor }),
      });
    }

    const postRecord = {
      id: `post_${Date.now()}`,
      correctAuthorId: targetAuthor.id,
      postText: itdResult.text || '',
      screenshot: itdResult.screenshot,
      hint: '',
      difficulty: 'normal',
      tags: ['#итд'],
    };

    try {
      const res = await fetch('/api/admin?action=save_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ post: postRecord }),
      });
      if (res.ok) {
        alert('Пост успешно добавлен в базу викторины!');
        setItdResult(null);
        setItdUrl('');
        loadAdminData(token);
      }
    } catch {}
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword.trim()) return;
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
      <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-[#121218] border border-white/10 shadow-2xl space-y-6 animate-in fade-in">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0080ff]/15 text-[#0080ff] flex items-center justify-center mx-auto mb-3">
            <Lock size={24} />
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-white">Вход в панель управления</h2>
          <p className="text-xs text-white/50">Доступ только для администраторов викторины</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase mb-2">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль..."
              className="w-full bg-[#181822] border border-white/15 focus:border-[#0080ff] rounded-xl px-4 py-3 text-white text-sm outline-none"
            />
          </div>

          {loginError && <p className="text-xs text-[#ef4444] font-medium">{loginError}</p>}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white font-semibold text-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoggingIn ? 'Проверка...' : 'Войти'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#121218] border border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#0080ff]/10 text-[#0080ff]">
            <Shield size={22} />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-white">Панель управления</h2>
            <p className="text-xs text-white/50">Управление контентом, авторами и модерация</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAdminData(token)}
            disabled={loadingData}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Обновить данные"
          >
            <RefreshCw size={16} className={loadingData ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] border border-[#ef4444]/30 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'posts', label: `Посты (${posts.length})` },
          { id: 'authors', label: `Авторы (${authors.length})` },
          { id: 'suggestions', label: `Заявки (${suggestions.length})` },
          { id: 'itd', label: 'Импорт из ИТД' },
          { id: 'password', label: 'Безопасность' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              soundFx.playClick();
              setActiveTab(tab.id as any);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#0080ff] text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'posts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((p) => {
              const author = authors.find((a) => a.id === p.correct_author_id);
              return (
                <div key={p.id} className="p-4 rounded-2xl bg-[#121218] border border-white/10 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    {p.screenshot && (
                      <div className="h-32 rounded-lg overflow-hidden bg-black/50 border border-white/5 flex items-center justify-center">
                        <img src={p.screenshot} alt="Превью" className="max-h-full object-contain" />
                      </div>
                    )}
                    <p className="text-xs text-white/80 line-clamp-2">{p.post_text || 'Скриншот поста'}</p>
                    <div className="text-[11px] text-white/40">
                      Автор: <span className="text-[#0080ff] font-semibold">{author?.name || p.correct_author_id}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePost(p.id)}
                    className="w-full py-1.5 rounded-lg bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Удалить пост</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'authors' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveAuthor} className="p-5 rounded-2xl bg-[#121218] border border-white/10 space-y-4">
            <h3 className="font-heading font-semibold text-sm text-white">Добавить нового автора</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Имя автора..."
                value={newAuthorName}
                onChange={(e) => setNewAuthorName(e.target.value)}
                className="bg-[#181822] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="text"
                placeholder="@handle автора..."
                value={newAuthorHandle}
                onChange={(e) => setNewAuthorHandle(e.target.value)}
                className="bg-[#181822] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="text"
                placeholder="Био / описание..."
                value={newAuthorBio}
                onChange={(e) => setNewAuthorBio(e.target.value)}
                className="bg-[#181822] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Сохранить автора
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {authors.map((a) => (
              <div key={a.id} className="p-3.5 rounded-xl bg-[#121218] border border-white/10 flex items-center justify-between">
                <div>
                  <strong className="text-xs text-white font-semibold block">{a.name}</strong>
                  <span className="text-[11px] text-white/40">{a.handle}</span>
                </div>
                <button
                  onClick={() => handleDeleteAuthor(a.id)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-[#ef4444] transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <div className="p-12 text-center text-white/40 text-sm">Новых предложений нет</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((s) => (
                <div key={s.id} className="p-4 rounded-2xl bg-[#121218] border border-white/10 space-y-3">
                  {s.screenshot && (
                    <div className="h-44 rounded-xl overflow-hidden bg-black/60 flex items-center justify-center">
                      <img src={s.screenshot} alt="Скриншот" className="max-h-full object-contain" />
                    </div>
                  )}
                  <p className="text-xs text-white/70">{s.post_text || 'Без текста'}</p>
                  <div className="text-[11px] text-white/40 space-y-0.5">
                    <div>Автор: <span className="text-white font-medium">{s.author_name}</span></div>
                    <div>Отправил: <span className="text-white/60">{s.submitted_by}</span></div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() =>
                        handleModerateSuggestion(s.id, 'approved', {
                          correctAuthorId: s.author_id || s.author_name,
                          screenshot: s.screenshot,
                          postText: s.post_text,
                        })
                      }
                      className="flex-1 py-2 rounded-xl bg-[#00ba7c]/15 hover:bg-[#00ba7c]/25 text-[#00ba7c] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check size={14} />
                      <span>Одобрить</span>
                    </button>
                    <button
                      onClick={() => handleModerateSuggestion(s.id, 'rejected')}
                      className="flex-1 py-2 rounded-xl bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                      <span>Отклонить</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'itd' && (
        <div className="p-6 rounded-2xl bg-[#121218] border border-white/10 space-y-5 max-w-xl">
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-base text-white">Парсинг поста из соцсети ИТД</h3>
            <p className="text-xs text-white/50">Вставьте ссылку на пост и токен авторизации ИТД для авто-загрузки</p>
          </div>

          <form onSubmit={handleFetchItd} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Ссылка на пост</label>
              <input
                type="text"
                value={itdUrl}
                onChange={(e) => setItdUrl(e.target.value)}
                placeholder="https://итд.com/@автор/post/00000000-0000-0000-0000-000000000000"
                className="w-full bg-[#181822] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 uppercase mb-1">Токен авторизации ИТД</label>
              <input
                type="text"
                value={itdToken}
                onChange={(e) => setItdToken(e.target.value)}
                placeholder="Токен авторизации ИТД..."
                className="w-full bg-[#181822] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={itdLoading}
              className="px-5 py-2.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {itdLoading ? 'Загрузка из ИТД...' : 'Получить пост'}
            </button>
          </form>

          {itdResult && (
            <div className="p-4 rounded-xl bg-[#181822] border border-white/10 space-y-3 animate-in fade-in">
              <div className="text-xs space-y-1">
                <div>Автор: <strong className="text-white">{itdResult.authorName}</strong> ({itdResult.authorHandle})</div>
                <div>Текст: <span className="text-white/70">{itdResult.text}</span></div>
              </div>

              {itdResult.screenshot && (
                <div className="h-40 rounded-lg overflow-hidden bg-black/50 flex items-center justify-center">
                  <img src={itdResult.screenshot} alt="Скриншот поста" className="max-h-full object-contain" />
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveItdPost}
                className="w-full py-2.5 rounded-xl bg-[#00ba7c] hover:bg-[#00a86b] text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Добавить пост в базу викторины
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="p-6 rounded-2xl bg-[#121218] border border-white/10 space-y-4 max-w-md">
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-base text-white">Смена пароля администратора</h3>
            <p className="text-xs text-white/50">Установите новый надежный пароль</p>
          </div>

          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Новый пароль..."
            className="w-full bg-[#181822] border border-white/15 rounded-xl px-4 py-3 text-xs text-white outline-none"
          />

          {passwordMsg && <p className="text-xs font-semibold text-[#00ba7c]">{passwordMsg}</p>}

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Обновить пароль
          </button>
        </form>
      )}
    </div>
  );
}
