'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AdminStats, Author } from '@/types';
import { soundFx } from '@/lib/sound';
import { useApp } from './AppProvider';
import { AdminAnalytics } from './AdminAnalytics';

export function AdminView() {
  const router = useRouter();
  const { startTestQuiz } = useApp();
  const goHome = () => {
    router.push('/');
  };

  const [token, setToken] = useState<string | null>(null);
  const [pinPassword, setPinPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [stats, setStats] = useState<AdminStats>({
    totalGames: 0,
    uniquePlayers: 0,
    topScore: 0,
    topPlayer: '—',
    totalPosts: 0,
    totalAuthors: 0,
    pendingPosts: 0,
    pendingAuthors: 0,
    dau: 0,
    wau: 0,
    gamesToday: 0,
    games7d: 0,
    completionRate: 0,
    returnRate: 0,
    avgScore: 0,
    avgAccuracy: 0,
    suggestionConversion: 0,
    daily: [],
    funnel: { started: 0, played: 0, submitted: 0 },
    hardQuestions: [],
  });

  const [posts, setPosts] = useState<any[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [authorSuggestions, setAuthorSuggestions] = useState<any[]>([]);

  const [itdUrl, setItdUrl] = useState('');
  const [itdToken, setItdToken] = useState('');
  const [itdLoading, setItdLoading] = useState(false);

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
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
  const postsPerPage = 15;

  const [authorsSearch, setAuthorsSearch] = useState('');
  const [authorsPage, setAuthorsPage] = useState(1);
  const authorsPerPage = 10;

  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const [showAuthorModal, setShowAuthorModal] = useState(false);
  const [editingAuthorId, setEditingAuthorId] = useState<string | null>(null);
  const [modalAuthorName, setModalAuthorName] = useState('');
  const [modalAuthorHandle, setModalAuthorHandle] = useState('');
  const [modalAuthorBadge, setModalAuthorBadge] = useState('');
  const [modalAuthorColor, setModalAuthorColor] = useState('linear-gradient(135deg, #0288d1, #26c6da)');
  const [modalAuthorBio, setModalAuthorBio] = useState('');
  const [modalAuthorVerified, setModalAuthorVerified] = useState(true);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

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
      const [resPosts, resAuthors, resSug, resStats] = await Promise.all([
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
        fetch('/api/admin?action=get_admin_stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        }),
      ]);

      const [dataPosts, dataAuthors, dataSug, dataStats] = await Promise.all([
        resPosts.json(),
        resAuthors.json(),
        resSug.json(),
        resStats.json(),
      ]);

      if (dataPosts.ok) setPosts(dataPosts.posts || []);
      if (dataAuthors.ok) setAuthors(dataAuthors.authors || []);
      if (dataSug.ok) {
        setSuggestions(dataSug.suggestions || []);
        setAuthorSuggestions(dataSug.authorSuggestions || []);
      }
      if (dataStats.ok && dataStats.stats) {
        setStats(dataStats.stats);
      }
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
    goHome();
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
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setCanvasHistory([ctx.getImageData(0, 0, img.width, img.height)]);
      }
    };
    img.src = dataUrl;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    setIsDrawing(true);
    setStartPos({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
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
        showToast('Пост загружен из ИТД');
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
      .map((t) => (t.trim().startsWith('#') ? t.trim() : '#' + t.trim()))
      .filter((t) => t.length > 1);

    const postPayload = {
      id: editingPostId || `post_${Date.now()}`,
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
        showToast(editingPostId ? 'Пост успешно обновлен' : 'Вопрос добавлен в викторину');
        soundFx.playCorrect();
        resetPostForm();
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

  const resetPostForm = () => {
    setEditingPostId(null);
    setScreenshotData(null);
    setCanvasHistory([]);
    setSelectedAuthor(null);
    setAuthorSearch('');
    setPostText('');
    setPostHint('');
    setPostTags('');
    setPostDiff('normal');
    setItdUrl('');
  };

  const handleEditPost = (post: any) => {
    setEditingPostId(post.id);
    setPostText(post.post_text || '');
    setPostHint(post.hint || '');
    setPostTags((post.tags || []).join(', '));
    setPostDiff(post.difficulty || 'normal');

    const author = authors.find((a) => a.id === post.correct_author_id);
    if (author) {
      setSelectedAuthor(author);
    }

    if (post.screenshot) {
      initCanvasWithImage(post.screenshot);
    }

    const formEl = document.getElementById('admin-post-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
    showToast('Редактирование вопроса');
  };

  const handleDeletePost = async (id: string) => {
    if (!window.confirm('Точно удалить этот вопрос из викторины?')) return;
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=delete_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        showToast('Вопрос удален');
        loadAdminData(token!);
      }
    } catch {}
  };

  const handleApprovePostSuggestion = async (suggestion: any, chosenAuthorId: string, hint: string) => {
    soundFx.playClick();
    let authorId = chosenAuthorId;
    if (!authorId) {
      const fallback = authors[0];
      authorId = fallback ? fallback.id : 'unknown';
    }

    const postRecord = {
      id: `post_${Date.now()}`,
      correctAuthorId: authorId,
      postText: suggestion.post_text || '',
      screenshot: suggestion.screenshot,
      hint: hint || (suggestion.post_url ? `Оригинал: ${suggestion.post_url}` : ''),
      difficulty: 'normal',
      tags: ['#итд'],
    };

    try {
      const res = await fetch('/api/admin?action=moderate_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: suggestion.id, status: 'approved', postRecord }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
        showToast('Пост одобрен и добавлен в викторину');
        loadAdminData(token!);
      }
    } catch {}
  };

  const handleRejectPostSuggestion = async (id: string) => {
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=moderate_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: 'rejected' }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
        showToast('Пост отклонен');
        loadAdminData(token!);
      }
    } catch {}
  };

  const handleApproveAuthorSuggestion = async (
    as: any,
    avatarColor: string,
    badge: string,
    bio: string
  ) => {
    soundFx.playClick();
    const handleClean = as.handle ? (as.handle.startsWith('@') ? as.handle : `@${as.handle}`) : `@${as.name.toLowerCase().replace(/[^a-z0-9_]/gi, '')}`;
    const authorRecord = {
      id: handleClean.replace('@', '').toLowerCase() || `author_${Date.now()}`,
      name: as.name,
      handle: handleClean,
      avatarColor: avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)',
      avatarText: as.name ? as.name[0].toUpperCase() : '?',
      badge: badge || 'Автор ИТД',
      bio: bio || 'Популярный автор в ИТД',
      verified: true,
    };

    try {
      const res = await fetch('/api/admin?action=moderate_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: as.id, status: 'approved', authorRecord }),
      });
      if (res.ok) {
        setAuthorSuggestions((prev) => prev.filter((item) => item.id !== as.id));
        showToast(`Автор ${as.name} одобрен и добавлен в пул`);
        loadAdminData(token!);
      }
    } catch {}
  };

  const handleRejectAuthorSuggestion = async (id: string) => {
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=moderate_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status: 'rejected' }),
      });
      if (res.ok) {
        setAuthorSuggestions((prev) => prev.filter((item) => item.id !== id));
        showToast('Заявка на автора отклонена');
        loadAdminData(token!);
      }
    } catch {}
  };

  const handleExportBackup = async () => {
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=export_backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.backup) {
        const json = JSON.stringify(data.backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `itd_quiz_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Резервная копия сохранена на устройство');
      }
    } catch {
      alert('Ошибка при выгрузке бэкапа');
    }
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backupData = JSON.parse(text);
        const res = await fetch('/api/admin?action=import_backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ backup: backupData }),
        });
        if (res.ok) {
          showToast('База данных успешно импортирована');
          loadAdminData(token!);
        } else {
          alert('Ошибка при импорте бэкапа');
        }
      } catch (err: any) {
        alert('Некорректный файл бэкапа: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleResetPresets = async () => {
    if (!window.confirm('Восстановить стартовый набор вопросов викторины?')) return;
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=reset_presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Стартовый пак обновлен');
        loadAdminData(token!);
      }
    } catch {}
  };

  const openCreateAuthorModal = () => {
    setEditingAuthorId(null);
    setModalAuthorName('');
    setModalAuthorHandle('');
    setModalAuthorBadge('');
    setModalAuthorColor('linear-gradient(135deg, #0288d1, #26c6da)');
    setModalAuthorBio('');
    setModalAuthorVerified(true);
    setShowAuthorModal(true);
  };

  const openEditAuthorModal = (author: Author) => {
    setEditingAuthorId(author.id);
    setModalAuthorName(author.name || '');
    setModalAuthorHandle(author.handle || '');
    setModalAuthorBadge(author.badge || '');
    setModalAuthorColor(author.avatar_color || author.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)');
    setModalAuthorBio(author.bio || '');
    setModalAuthorVerified(author.verified !== undefined ? Boolean(author.verified) : true);
    setShowAuthorModal(true);
  };

  const handleSaveAuthorModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAuthorName.trim()) return;
    soundFx.playClick();

    const cleanHandle = modalAuthorHandle.trim().startsWith('@')
      ? modalAuthorHandle.trim()
      : `@${modalAuthorHandle.trim()}`;

    const authorPayload: Author = {
      id: editingAuthorId || cleanHandle.replace('@', '').toLowerCase() || `author_${Date.now()}`,
      name: modalAuthorName.trim(),
      handle: cleanHandle,
      badge: modalAuthorBadge.trim() || null,
      avatarColor: modalAuthorColor,
      avatarText: modalAuthorName.trim()[0] || '?',
      bio: modalAuthorBio.trim() || null,
      verified: modalAuthorVerified,
    };

    try {
      const res = await fetch('/api/admin?action=save_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ author: authorPayload }),
      });
      if (res.ok) {
        setShowAuthorModal(false);
        showToast(editingAuthorId ? `Автор ${modalAuthorName} обновлен` : `Автор ${modalAuthorName} добавлен`);
        loadAdminData(token!);
      }
    } catch {}
  };

  const handleDeleteAuthor = async (id: string, name: string) => {
    if (!window.confirm(`Удалить автора "${name}" из базы?`)) return;
    soundFx.playClick();
    try {
      const res = await fetch('/api/admin?action=delete_author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAuthors((prev) => prev.filter((a) => a.id !== id));
        showToast('Автор удален');
        loadAdminData(token!);
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
        showToast('Пароль администратора обновлен');
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
          <button className="modal-close-btn" id="btn-close-pin-modal" onClick={goHome}>
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
      (a.handle || '').toLowerCase().includes(q) ||
      (a.bio || '').toLowerCase().includes(q) ||
      (a.badge || '').toLowerCase().includes(q)
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
          <h1 className="admin-page-title">Панель управления</h1>
          <span id="admin-db-status" className="admin-badge-count">
            Supabase активен
          </span>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="btn-primary-action"
            id="btn-admin-go-home"
            onClick={goHome}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            ← На главную
          </button>
          <button
            type="button"
            className="btn-secondary-action"
            id="btn-admin-refresh-stats"
            onClick={() => {
              loadAdminData(token);
              showToast('Статистика обновлена');
            }}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            Обновить статистику
          </button>
          <button
            type="button"
            className="btn-danger-outline"
            id="btn-admin-logout"
            onClick={handleLogout}
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="admin-stats-dashboard">
        <div className="admin-stat-metric-card">
          <div className="asm-header">
            <span>Игр сыграно</span>
            <span className="asm-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="2"></rect></svg>
            </span>
          </div>
          <div className="asm-value" id="admin-stat-total-games">{stats.totalGames}</div>
          <div className="asm-hint">Всего матчей в базе</div>
        </div>
        <div className="admin-stat-metric-card">
          <div className="asm-header">
            <span>Игроков</span>
            <span className="asm-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </span>
          </div>
          <div className="asm-value" id="admin-stat-unique-players">{stats.uniquePlayers}</div>
          <div className="asm-hint">Уникальных ников</div>
        </div>
        <div className="admin-stat-metric-card">
          <div className="asm-header">
            <span>Рекорд очков</span>
            <span className="asm-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"></path><path d="M18 4H6v7a6 6 0 0 0 12 0V4z"></path></svg>
            </span>
          </div>
          <div className="asm-value" id="admin-stat-top-score">{stats.topScore}</div>
          <div className="asm-hint" id="admin-stat-top-player">{stats.topPlayer !== '—' ? `Лидер: ${stats.topPlayer}` : '—'}</div>
        </div>
        <div className="admin-stat-metric-card">
          <div className="asm-header">
            <span>Постов в игре</span>
            <span className="asm-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </span>
          </div>
          <div className="asm-value" id="admin-stat-active-posts">{stats.totalPosts || posts.length}</div>
          <div className="asm-hint" id="admin-total-posts-badge">{stats.totalPosts || posts.length} постов</div>
        </div>
        <div className="admin-stat-metric-card">
          <div className="asm-header">
            <span>Авторов в пуле</span>
            <span className="asm-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
          </div>
          <div className="asm-value" id="admin-stat-active-authors">{stats.totalAuthors || authors.length}</div>
          <div className="asm-hint">Доступно для викторины</div>
        </div>
        <div className="admin-stat-metric-card">
          <div className="asm-header">
            <span>На модерации</span>
            <span className="asm-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </span>
          </div>
          <div className="asm-value" id="admin-stat-pending-total">{suggestions.length + authorSuggestions.length}</div>
          <div className="asm-hint" id="admin-stat-pending-detail">{suggestions.length} постов, {authorSuggestions.length} авторов</div>
        </div>
      </div>

      <AdminAnalytics stats={stats} />

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Модерация предложенных постов</span>
          <span className="admin-badge-count" id="admin-pending-sugg-count">{suggestions.length} предложений</span>
        </div>
        <div id="admin-pending-suggestions-list" className="admin-suggestions-container">
          {suggestions.length === 0 ? (
            <div className="table-empty">Нет постов, ожидающих модерации</div>
          ) : (
            suggestions.map((s) => {
              const author = s.author_id ? authors.find((a) => a.id === s.author_id) : null;
              const authorDisplayName = author ? `${author.name} (${author.handle})` : (s.author_name || 'Не указан');

              let postUrl = s.itd_url || s.post_url;
              let postTextClean = s.post_text || '';
              const urlMatch = postTextClean.match(/(?:🔗|\[URL:)\s*(https?:\/\/[^\s\]]+)/);
              if (urlMatch) {
                postUrl = postUrl || urlMatch[1];
                postTextClean = postTextClean.replace(/(?:🔗|\[URL:)\s*https?:\/\/[^\s\]]+\]?/, '').trim();
              }
              const hintMatch = postTextClean.match(/\[HINT:\s*([^\]]+)\]/);
              let postHintClean = '';
              if (hintMatch) {
                postHintClean = hintMatch[1].trim();
                postTextClean = postTextClean.replace(/\[HINT:\s*[^\]]+\]/, '').trim();
              }

              return (
                <div key={s.id} className="admin-suggestion-card">
                  <img
                    src={s.screenshot}
                    alt="Предложенный скриншот"
                    className="asc-thumb"
                    onClick={() => setLightboxImage(s.screenshot)}
                  />
                  <div className="asc-info">
                    <div className="asc-author-line">
                      Автор: <strong>{authorDisplayName}</strong>
                    </div>
                    <div className="asc-meta-line">
                      Предложил: <strong>{s.submitted_by || 'Аноним'}</strong>
                    </div>
                    {postUrl && (
                      <div className="asc-link-row">
                        <a
                          href={postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="asc-external-link"
                        >
                          <span>Ссылка на пост в ИТД</span> ↗
                        </a>
                      </div>
                    )}
                    {postTextClean && <p className="asc-comment">{postTextClean}</p>}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        Автор для викторины:
                      </label>
                      <select
                        className="asc-author-select"
                        defaultValue={s.author_id || ''}
                        id={`asc-select-${s.id}`}
                      >
                        <option value="">— Привязать к автору —</option>
                        {authors.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.handle})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="asc-actions">
                      <button
                        type="button"
                        className="btn-approve"
                        onClick={() => {
                          const selectEl = document.getElementById(`asc-select-${s.id}`) as HTMLSelectElement | null;
                          const chosenAuthorId = selectEl?.value || s.author_id || authors[0]?.id;
                          handleApprovePostSuggestion(s, chosenAuthorId, postHintClean);
                        }}
                      >
                        ✓ Одобрить в викторину
                      </button>
                      <button
                        type="button"
                        className="btn-reject"
                        onClick={() => handleRejectPostSuggestion(s.id)}
                      >
                        ✕ Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Модерация предложенных авторов</span>
          <span className="admin-badge-count" id="admin-pending-authors-count">{authorSuggestions.length} предложений</span>
        </div>
        <div id="admin-pending-authors-list" className="admin-suggestions-container">
          {authorSuggestions.length === 0 ? (
            <div className="table-empty">Нет авторов, ожидающих модерации</div>
          ) : (
            authorSuggestions.map((as) => {
              const firstChar = (as.name && as.name.length > 0 ? as.name[0] : '?').toUpperCase();
              let bioClean = as.bio || '';
              let badgeClean = as.badge || '';
              let avatarColorClean = as.avatar_color || as.avatarColor || 'linear-gradient(135deg, #7c3aed, #ec4899)';

              const colorMatch = bioClean.match(/\[COLOR:\s*([^\]]+)\]/);
              if (colorMatch) {
                avatarColorClean = colorMatch[1].trim();
                bioClean = bioClean.replace(/\[COLOR:\s*[^\]]+\]/, '').trim();
              }
              const badgeMatch = bioClean.match(/\[BADGE:\s*([^\]]+)\]/);
              if (badgeMatch) {
                badgeClean = badgeMatch[1].trim();
                bioClean = bioClean.replace(/\[BADGE:\s*[^\]]+\]/, '').trim();
              }
              const profileMatch = bioClean.match(/\[PROFILE:\s*([^\]]+)\]/);
              let profileClean = '';
              if (profileMatch) {
                profileClean = profileMatch[1].trim();
                bioClean = bioClean.replace(/\[PROFILE:\s*[^\]]+\]/, '').trim();
              }

              return (
                <div key={as.id} className="admin-author-suggestion-card">
                  <div className="aasc-avatar" style={{ background: avatarColorClean }}>
                    {firstChar}
                  </div>
                  <div className="aasc-info">
                    <div className="aasc-header-row">
                      <strong className="aasc-name">{as.name}</strong>
                      <span className="aasc-handle">{as.handle || `@${as.name}`}</span>
                      {badgeClean && (
                        <span className="author-badge-pill" style={{ marginLeft: 6, fontSize: 10 }}>
                          {badgeClean}
                        </span>
                      )}
                    </div>
                    <div className="aasc-meta">
                      Предложил: <strong>{as.submitted_by || 'Аноним'}</strong>
                      {profileClean && (
                        <> · <a href={profileClean} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>Профиль в ИТД ↗</a></>
                      )}
                    </div>
                    {bioClean && <div className="aasc-bio">{bioClean}</div>}
                    <div className="aasc-actions">
                      <button
                        type="button"
                        className="btn-approve aasc-btn-approve"
                        onClick={() => handleApproveAuthorSuggestion(as, avatarColorClean, badgeClean, bioClean)}
                      >
                        ✓ Одобрить автора
                      </button>
                      <button
                        type="button"
                        className="btn-reject aasc-btn-reject"
                        onClick={() => handleRejectAuthorSuggestion(as.id)}
                      >
                        ✕ Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title" id="admin-form-title">
          {editingPostId ? 'Редактирование вопроса' : 'Загрузка скриншота поста'}
        </h2>

        <div className="form-group" id="admin-itd-import" style={{ marginBottom: 16 }}>
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
                      <div className="author-suggestions-dropdown">
                        {authors
                          .filter(
                            (a) =>
                              (a.name || '').toLowerCase().includes(authorSearch.toLowerCase()) ||
                              (a.handle || '').toLowerCase().includes(authorSearch.toLowerCase())
                          )
                          .map((a) => (
                            <div
                              key={a.id}
                              className="author-suggestion-item"
                              onClick={() => {
                                setSelectedAuthor(a);
                                setAuthorSearch('');
                                setShowAuthorDropdown(false);
                              }}
                            >
                              <div
                                className="asi-avatar"
                                style={{
                                  background: a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)',
                                }}
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
                      style={{
                        background: selectedAuthor.avatar_color || selectedAuthor.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)',
                      }}
                    >
                      {selectedAuthor.avatar_text || selectedAuthor.avatarText || (selectedAuthor.name ? selectedAuthor.name[0] : '?')}
                    </div>
                    <span className="sap-name">{selectedAuthor.name}</span>
                    <span className="sap-handle">{selectedAuthor.handle}</span>
                    <button
                      type="button"
                      className="sap-remove-btn"
                      onClick={() => setSelectedAuthor(null)}
                      title="Сменить автора"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group col-span-2">
              <label className="form-label" htmlFor="admin-post-text">
                Текст поста (необязательно, для поиска)
              </label>
              <textarea
                id="admin-post-text"
                rows={2}
                placeholder="Краткое содержание или цитата из поста..."
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-post-hint">
                Подсказка для игроков
              </label>
              <input
                type="text"
                id="admin-post-hint"
                placeholder="Например: Автор часто пишет про деплой в пятницу"
                value={postHint}
                onChange={(e) => setPostHint(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-post-tags">
                Теги (через запятую)
              </label>
              <input
                type="text"
                id="admin-post-tags"
                placeholder="#итд, #щитпост, #жиза"
                value={postTags}
                onChange={(e) => setPostTags(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-post-diff">
                Сложность вопроса
              </label>
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
              onClick={resetPostForm}
            >
              Очистить
            </button>
            <button
              type="submit"
              className="btn-primary-action"
              id="btn-admin-submit"
              disabled={isSavingPost}
            >
              {isSavingPost ? 'Сохранение...' : editingPostId ? 'Сохранить изменения' : 'Добавить в викторину'}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Вопросы в базе</span>
          <button
            type="button"
            className="btn-secondary-action"
            id="btn-reset-presets"
            onClick={handleResetPresets}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            Восстановить стартовый пак
          </button>
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
                <th>#</th>
                <th>Скриншот</th>
                <th>Автор</th>
                <th>Подсказка</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody id="admin-posts-tbody">
              {paginatedPosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    {postsSearch ? 'По вашему запросу ничего не найдено' : 'В базе пока нет постов. Добавьте первый скриншот выше!'}
                  </td>
                </tr>
              ) : (
                paginatedPosts.map((post, i) => {
                  const globalIdx = (postsPage - 1) * postsPerPage + i + 1;
                  const author = authors.find((a) => a.id === post.correct_author_id) || {
                    name: post.correct_author_id,
                    handle: `@${post.correct_author_id}`,
                  };

                  return (
                    <tr key={post.id}>
                      <td className="col-num">{globalIdx}</td>
                      <td className="col-thumb">
                        <img
                          src={post.screenshot}
                          alt="Thumb"
                          className="post-table-thumb"
                          onClick={() => setLightboxImage(post.screenshot)}
                        />
                      </td>
                      <td className="col-author">
                        <div className="table-author-cell">
                          <strong>{author.name}</strong>
                          <small>{author.handle}</small>
                        </div>
                      </td>
                      <td className="col-hint">{post.hint || '—'}</td>
                      <td className="col-actions">
                        <button
                          type="button"
                          className="btn-action-icon test-btn"
                          title="Протестировать вопрос"
                          onClick={() => {
                            startTestQuiz(post);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon edit-btn"
                          title="Редактировать"
                          onClick={() => handleEditPost(post)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon del-btn"
                          title="Удалить"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
            {filteredPosts.length === 0 ? '0 вопросов' : `Показано ${(postsPage - 1) * postsPerPage + 1}–${Math.min(filteredPosts.length, postsPage * postsPerPage)} из ${filteredPosts.length} вопросов`}
          </div>
          <div className="admin-pagination-controls">
            <button
              type="button"
              className="btn-page-nav"
              id="btn-posts-prev"
              title="Предыдущая страница"
              disabled={postsPage <= 1}
              onClick={() => setPostsPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </button>
            <span className="admin-page-number" id="posts-page-number">
              {postsPage} / {totalPostsPages}
            </span>
            <button
              type="button"
              className="btn-page-nav"
              id="btn-posts-next"
              title="Следующая страница"
              disabled={postsPage >= totalPostsPages}
              onClick={() => setPostsPage((p) => Math.min(totalPostsPages, p + 1))}
            >
              Вперед →
            </button>
          </div>
        </div>

        <div className="admin-backup-bar">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Резервная копия (скриншоты и посты):
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn-secondary-action"
              id="btn-export-backup"
              onClick={handleExportBackup}
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              Экспорт JSON
            </button>
            <label className="btn-secondary-action" style={{ fontSize: 12, padding: '6px 14px', cursor: 'pointer' }}>
              Импорт JSON
              <input
                type="file"
                id="input-import-backup"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleImportBackup(e.target.files[0]);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-title">
          <span>Пул авторов ИТД</span>
          <button
            type="button"
            className="btn-primary-action"
            id="btn-open-new-author-modal"
            style={{ fontSize: 12, padding: '6px 16px' }}
            onClick={openCreateAuthorModal}
          >
            + Добавить автора
          </button>
        </div>

        <div className="admin-filter-bar">
          <input
            type="text"
            id="admin-authors-search-input"
            className="search-input"
            placeholder="Поиск авторов по имени или @handle..."
            value={authorsSearch}
            onChange={(e) => {
              setAuthorsSearch(e.target.value);
              setAuthorsPage(1);
            }}
          />
        </div>

        <div className="admin-authors-list admin-authors-scroll-container" id="admin-authors-list">
          {paginatedAuthors.length === 0 ? (
            <div className="table-empty" style={{ gridColumn: '1 / -1' }}>
              {authorsSearch ? 'Авторы по запросу не найдены' : 'Авторов в базе пока нет. Нажмите «+ Добавить автора».'}
            </div>
          ) : (
            paginatedAuthors.map((a) => (
              <div key={a.id} className="admin-author-item">
                <div
                  className="aai-avatar"
                  style={{ background: a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)' }}
                >
                  {a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?')}
                </div>
                <div className="aai-info">
                  <div className="aai-name-row">
                    <strong>{a.name}</strong>
                    {a.verified && (
                      <span className="verified-icon">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </span>
                    )}
                    {a.badge && <span className="badge-tag">{a.badge}</span>}
                  </div>
                  <span className="aai-handle">{a.handle || `@${a.id}`}</span>
                  {(a.bio || a.style) && <p className="aai-bio">{a.bio || a.style}</p>}
                </div>
                <div className="aai-actions">
                  <button
                    type="button"
                    className="btn-edit-author"
                    title="Редактировать автора"
                    onClick={() => openEditAuthorModal(a)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  </button>
                  <button
                    type="button"
                    className="btn-del-author"
                    title="Удалить автора"
                    onClick={() => handleDeleteAuthor(a.id, a.name)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="admin-pagination-bar" id="admin-authors-pagination">
          <div className="admin-pagination-info" id="admin-authors-page-info">
            {filteredAuthors.length === 0 ? '0 авторов' : `Показано ${(authorsPage - 1) * authorsPerPage + 1}–${Math.min(filteredAuthors.length, authorsPage * authorsPerPage)} из ${filteredAuthors.length} авторов`}
          </div>
          <div className="admin-pagination-controls">
            <button
              type="button"
              className="btn-page-nav"
              id="btn-authors-prev"
              title="Предыдущая страница"
              disabled={authorsPage <= 1}
              onClick={() => setAuthorsPage((p) => Math.max(1, p - 1))}
            >
              ← Назад
            </button>
            <span className="admin-page-number" id="authors-page-number">
              {authorsPage} / {totalAuthorsPages}
            </span>
            <button
              type="button"
              className="btn-page-nav"
              id="btn-authors-next"
              title="Следующая страница"
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
        <button type="button" className="btn-secondary-action" onClick={goHome}>
          ← Вернуться на главную
        </button>
        <button type="button" className="btn-danger-outline" onClick={handleLogout}>
          Выйти из панели управления
        </button>
      </div>

      {showAuthorModal && (
        <div className="modal-backdrop" id="modal-new-author" style={{ display: 'flex' }}>
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <button className="modal-close-btn" id="btn-close-new-author-modal" onClick={() => setShowAuthorModal(false)}>
              ✕
            </button>
            <h2 className="modal-title" id="modal-author-title">
              {editingAuthorId ? 'Редактировать автора' : 'Добавить автора в базу'}
            </h2>
            <form id="form-add-author" onSubmit={handleSaveAuthorModal}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Отображаемое имя *</label>
                <input
                  type="text"
                  id="modal-author-name"
                  required
                  placeholder="Например: Шляпа Боярского"
                  value={modalAuthorName}
                  onChange={(e) => setModalAuthorName(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Handle (@никнейм)</label>
                <input
                  type="text"
                  id="modal-author-handle"
                  placeholder="@shlyapa"
                  value={modalAuthorHandle}
                  onChange={(e) => setModalAuthorHandle(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Бейдж / титул</label>
                <input
                  type="text"
                  id="modal-author-badge"
                  placeholder="Топ-автор, Dev, Основатель..."
                  value={modalAuthorBadge}
                  onChange={(e) => setModalAuthorBadge(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Цвет аватара</label>
                <select
                  id="modal-author-color"
                  value={modalAuthorColor}
                  onChange={(e) => setModalAuthorColor(e.target.value)}
                >
                  <option value="linear-gradient(135deg, #0288d1, #26c6da)">Голубой неон</option>
                  <option value="linear-gradient(135deg, #7c3aed, #ec4899)">Фиолетово-розовый</option>
                  <option value="linear-gradient(135deg, #ef4444, #f97316)">Огненный</option>
                  <option value="linear-gradient(135deg, #10b981, #06b6d4)">Изумрудный</option>
                  <option value="linear-gradient(135deg, #f59e0b, #ef4444)">Янтарный</option>
                  <option value="linear-gradient(135deg, #3b82f6, #8b5cf6)">Индиго</option>
                  <option value="linear-gradient(135deg, #ec4899, #f43f5e)">Малиновый</option>
                  <option value="linear-gradient(135deg, #84cc16, #22c55e)">Лаймовый</option>
                  <option value="linear-gradient(135deg, #14b8a6, #3b82f6)">Морской</option>
                  <option value="linear-gradient(135deg, #f97316, #facc15)">Закат</option>
                  <option value="linear-gradient(135deg, #a855f7, #6366f1)">Лавандовый</option>
                  <option value="linear-gradient(135deg, #06b6d4, #22c55e)">Мятный</option>
                  <option value="linear-gradient(135deg, #f43f5e, #fb923c)">Коралловый</option>
                  <option value="linear-gradient(135deg, #64748b, #0f172a)">Графитовый</option>
                  <option value="linear-gradient(135deg, #d946ef, #f59e0b)">Фуксия-золото</option>
                  <option value="linear-gradient(135deg, #0ea5e9, #6366f1)">Небесный</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Стиль / био автора</label>
                <textarea
                  id="modal-author-bio"
                  rows={2}
                  placeholder="О чем обычно пишет этот автор..."
                  value={modalAuthorBio}
                  onChange={(e) => setModalAuthorBio(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 20, flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="modal-author-verified"
                  checked={modalAuthorVerified}
                  onChange={(e) => setModalAuthorVerified(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="modal-author-verified" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Галочка верификации
                </label>
              </div>
              <button
                type="submit"
                className="btn-primary-action"
                id="btn-save-author-modal"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {editingAuthorId ? 'Сохранить изменения' : 'Сохранить автора'}
              </button>
            </form>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          className="lightbox-backdrop"
          id="image-lightbox"
          onClick={() => setLightboxImage(null)}
        >
          <div className="lightbox-content">
            <img src={lightboxImage} alt="Zoomed Screenshot" className="lightbox-img" id="lightbox-img" />
          </div>
        </div>
      )}

      {toastMessage && (
        <div id="toast-container">
          <div className="toast toast-success">{toastMessage}</div>
        </div>
      )}
    </section>
  );
}
