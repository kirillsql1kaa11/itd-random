'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { GameHistoryItem, GameMode, GameResult, QuizQuestion, SubmitState, UserStats } from '@/types';
import { soundFx } from '@/lib/sound';
import { getPlayerId } from '@/lib/player';

const RulesModal = dynamic(() => import('./RulesModal').then((m) => m.RulesModal));
const SuggestPostModal = dynamic(() => import('./SuggestPostModal').then((m) => m.SuggestPostModal));
const SuggestAuthorModal = dynamic(() => import('./SuggestAuthorModal').then((m) => m.SuggestAuthorModal));

export interface QuizApiData {
  isCorrect?: boolean;
  timedOut?: boolean;
  pointsEarned?: number;
  correctAuthorId?: string | null;
  correctAuthor?: any;
  alreadyAnswered?: boolean;
  sessionScore?: number;
  sessionStreak?: number;
  sessionMaxStreak?: number;
  sessionCorrectCount?: number;
  sessionTotalCount?: number;
  questions?: QuizQuestion[];
  sessionId?: string | null;
  error?: string;
}

interface QuizRequestError extends Error {
  status?: number;
}

async function fetchQuiz(body: Record<string, unknown>, attempt = 0): Promise<QuizApiData> {
  let res: Response;
  try {
    res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 700));
      return fetchQuiz(body, attempt + 1);
    }
    const error = new Error('Сеть недоступна') as QuizRequestError;
    error.status = 0;
    throw error;
  }

  if (!res.ok) {
    if (res.status >= 500 && attempt < 1) {
      await new Promise((r) => setTimeout(r, 700));
      return fetchQuiz(body, attempt + 1);
    }
    const data = await res.json().catch(() => ({}));
    const base = data?.error || `Ошибка ${res.status}`;
    const error = new Error(data?.details ? `${base}: ${data.details}` : base) as QuizRequestError;
    error.status = res.status;
    throw error;
  }

  return res.json();
}

export function getStreakMultiplier(currentStreak: number): number {
  if (currentStreak >= 8) return 3.0;
  if (currentStreak >= 5) return 2.0;
  if (currentStreak >= 3) return 1.5;
  return 1.0;
}

interface QuizState {
  questions: QuizQuestion[];
  sessionId: string | null;
  currentIdx: number;
  score: number;
  streak: number;
  maxStreak: number;
  lives: number;
  correctCount: number;
  totalAnswered: number;
  timeLeft: number;
  maxTime: number;
  isAnswered: boolean;
  selectedAuthorId: string | null;
  correctAuthorId: string | null;
  eliminatedIds: string[];
  hintUsed: boolean;
  hints5050Left: number;
  textHintsLeft: number;
  showTextHint: boolean;
  isLoadingQuiz: boolean;
  isTest: boolean;
  gameHistory: GameHistoryItem[];
  lastEarnedPoints: number;
  currentCorrectAuthor: any;
  activeMode: GameMode;
}

const initialQuizState: QuizState = {
  questions: [],
  sessionId: null,
  currentIdx: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  lives: 3,
  correctCount: 0,
  totalAnswered: 0,
  timeLeft: 15,
  maxTime: 15,
  isAnswered: false,
  selectedAuthorId: null,
  correctAuthorId: null,
  eliminatedIds: [],
  hintUsed: false,
  hints5050Left: 1,
  textHintsLeft: 3,
  showTextHint: false,
  isLoadingQuiz: false,
  isTest: false,
  gameHistory: [],
  lastEarnedPoints: 0,
  currentCorrectAuthor: null,
  activeMode: 'blitz',
};

interface AppContextValue extends QuizState {
  nickname: string;
  handleNicknameChange: (name: string) => void;
  selectedMode: GameMode;
  setSelectedMode: (mode: GameMode) => void;
  isRulesOpen: boolean;
  openRules: () => void;
  closeRules: () => void;
  isSuggestPostOpen: boolean;
  openSuggestPost: () => void;
  closeSuggestPost: () => void;
  isSuggestAuthorOpen: boolean;
  openSuggestAuthor: () => void;
  closeSuggestAuthor: () => void;
  result: GameResult | null;
  submitState: SubmitState;
  startQuiz: () => Promise<void>;
  startTestQuiz: (post: any) => Promise<void>;
  selectOption: (authorId: string) => Promise<void>;
  use5050: () => void;
  useHint: () => void;
  skipQuestion: () => void;
  nextQuestion: () => void;
  finishGame: () => void;
  finishPractice: () => void;
  submitResult: () => Promise<void>;
  getMultiplier: (streak: number) => number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [nickname, setNickname] = useState('Аноним');
  const [selectedMode, setSelectedMode] = useState<GameMode>('blitz');
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSuggestPostOpen, setIsSuggestPostOpen] = useState(false);
  const [isSuggestAuthorOpen, setIsSuggestAuthorOpen] = useState(false);
  const [quiz, setQuiz] = useState<QuizState>(initialQuizState);
  const [result, setResult] = useState<GameResult | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const statsRef = useRef({ score: 0, streak: 0, maxStreak: 0, correctCount: 0, totalAnswered: 0 });
  const historyRef = useRef<GameHistoryItem[]>([]);
  const quizRef = useRef(quiz);
  const resultRef = useRef<GameResult | null>(null);
  const submitStateRef = useRef<SubmitState>('idle');
  const statsSavedRef = useRef(false);

  quizRef.current = quiz;
  resultRef.current = result;
  submitStateRef.current = submitState;

  const patchQuiz = useCallback((patch: Partial<QuizState>) => {
    setQuiz((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyServerStats = useCallback((data: QuizApiData) => {
    const next = {
      score: Number(data.sessionScore ?? statsRef.current.score) || 0,
      streak: Number(data.sessionStreak ?? statsRef.current.streak) || 0,
      maxStreak: Number(data.sessionMaxStreak ?? statsRef.current.maxStreak) || 0,
      correctCount: Number(data.sessionCorrectCount ?? statsRef.current.correctCount) || 0,
      totalAnswered: Number(data.sessionTotalCount ?? statsRef.current.totalAnswered) || 0,
    };
    statsRef.current = next;
    patchQuiz(next);
  }, [patchQuiz]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetQuizState = useCallback((mode: GameMode, isTest: boolean) => {
    clearTimer();
    statsRef.current = { score: 0, streak: 0, maxStreak: 0, correctCount: 0, totalAnswered: 0 };
    historyRef.current = [];
    statsSavedRef.current = false;
    setResult(null);
    setSubmitState('idle');
    setQuiz({ ...initialQuizState, activeMode: mode, isTest });
  }, [clearTimer]);

  const startQuiz = useCallback(async () => {
    const mode = selectedMode;
    resetQuizState(mode, false);
    setIsSuggestPostOpen(false);
    patchQuiz({ isLoadingQuiz: true });
    router.push('/play');
    try {
      const playerId = getPlayerId();
      const data = await fetchQuiz({ action: 'get_questions', mode, playerId });
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error(data.error || 'Пустой набор вопросов');
      }
      setQuiz((prev) => ({
        ...prev,
        questions: data.questions as QuizQuestion[],
        sessionId: data.sessionId || null,
        isLoadingQuiz: false,
      }));
    } catch (err: any) {
      patchQuiz({ isLoadingQuiz: false });
      alert(err?.message || 'Не удалось загрузить вопросы викторины');
      router.replace('/');
    }
  }, [selectedMode, resetQuizState, patchQuiz, router]);

  const startTestQuiz = useCallback(async (post: any) => {
    if (!post?.id) return;
    resetQuizState('practice', true);
    patchQuiz({ isLoadingQuiz: true });
    router.push('/play');
    try {
      const adminToken = typeof window !== 'undefined' ? sessionStorage.getItem('itd_admin_token') : null;
      const data = await fetchQuiz({ action: 'test_question', postId: post.id, adminToken });
      if (!Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error(data.error || 'Пустой набор вопросов');
      }
      setQuiz((prev) => ({
        ...prev,
        questions: data.questions as QuizQuestion[],
        sessionId: data.sessionId || null,
        isLoadingQuiz: false,
      }));
    } catch (err: any) {
      patchQuiz({ isLoadingQuiz: false });
      alert(err?.message || 'Не удалось подготовить тестовый вопрос');
      router.replace('/admin');
    }
  }, [resetQuizState, patchQuiz, router]);

  const finishGame = useCallback(() => {
    clearTimer();
    const stats = statsRef.current;
    const total = stats.totalAnswered;
    const accuracy = total > 0 ? Math.round((stats.correctCount / total) * 100) : 0;
    const gameResult: GameResult = {
      score: stats.score,
      accuracy,
      maxStreak: stats.maxStreak,
      correctCount: stats.correctCount,
      totalCount: total,
      mode: quizRef.current.activeMode,
      isTest: quizRef.current.isTest,
      history: [...historyRef.current],
    };
    setResult(gameResult);
    setSubmitState('idle');
    submitStateRef.current = 'idle';
    router.push('/result');
  }, [clearTimer, router]);

  const saveLocalGameStats = useCallback((gameResult: GameResult) => {
    if (gameResult.isTest || statsSavedRef.current) return;
    statsSavedRef.current = true;
    try {
      const saved = localStorage.getItem('itd_user_stats');
      const stats: UserStats = saved ? JSON.parse(saved) : {
        gamesPlayed: 0,
        totalScore: 0,
        bestScore: 0,
        maxStreak: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        history: [],
      };

      stats.gamesPlayed += 1;
      stats.totalScore += gameResult.score;
      stats.bestScore = Math.max(stats.bestScore, gameResult.score);
      stats.maxStreak = Math.max(stats.maxStreak, gameResult.maxStreak);
      stats.correctAnswers += gameResult.correctCount;
      stats.totalAnswers += gameResult.totalCount;
      stats.history.push({
        date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        score: gameResult.score,
        accuracy: gameResult.accuracy,
        mode: gameResult.mode,
      });
      localStorage.setItem('itd_user_stats', JSON.stringify(stats));
    } catch {}
  }, []);

  const submitResult = useCallback(async () => {
    const gameResult = resultRef.current;
    if (!gameResult || gameResult.isTest) return;
    if (submitStateRef.current === 'saving' || submitStateRef.current === 'done') return;
    const sessionId = quizRef.current.sessionId;
    if (!sessionId) {
      submitStateRef.current = 'error';
      setSubmitState('error');
      return;
    }

    submitStateRef.current = 'saving';
    setSubmitState('saving');
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_game', sessionId, nickname, playerId: getPlayerId() }),
      });
      if (!res.ok) throw new Error('submit failed');
      submitStateRef.current = 'done';
      setSubmitState('done');
    } catch {
      submitStateRef.current = 'error';
      setSubmitState('error');
    } finally {
      saveLocalGameStats(gameResult);
    }
  }, [nickname, saveLocalGameStats]);

  const selectOption = useCallback(async (chosenAuthorId: string) => {
    const state = quizRef.current;
    const question = state.questions[state.currentIdx];
    if (!question || state.isAnswered) return;

    clearTimer();
    patchQuiz({ isAnswered: true, selectedAuthorId: chosenAuthorId });

    try {
      const data = await fetchQuiz({
        action: 'check_answer',
        qToken: question.qToken,
        sessionId: state.sessionId,
        selectedAuthorId: chosenAuthorId,
        timeLeft: state.timeLeft,
        hintUsed: state.hintUsed,
      });

      const isCorrect = Boolean(data.isCorrect);
      const resolvedAuthor = data.correctAuthor
        || question.options.find((o) => o.id === data.correctAuthorId)
        || null;

      applyServerStats(data);
      patchQuiz({
        correctAuthorId: data.correctAuthorId || chosenAuthorId,
        currentCorrectAuthor: resolvedAuthor,
        lastEarnedPoints: Number(data.pointsEarned) || 0,
      });

      if (isCorrect) {
        soundFx.playCorrect();
        if (Number(data.sessionStreak) >= 3) soundFx.playStreak();
      } else {
        soundFx.playWrong();
      }

      const historyItem: GameHistoryItem = {
        post: question,
        correctAuthor: {
          name: resolvedAuthor?.name || 'Автор',
          handle: resolvedAuthor?.handle || `@${data.correctAuthorId || 'handle'}`,
          avatarColor: resolvedAuthor?.avatarColor || resolvedAuthor?.avatar_color,
          avatarText: resolvedAuthor?.avatarText || resolvedAuthor?.avatar_text,
          bio: resolvedAuthor?.bio,
        },
        chosenAuthorId,
        isCorrect,
      };
      historyRef.current = [...historyRef.current, historyItem];
      patchQuiz({ gameHistory: historyRef.current });

      if (state.activeMode === 'survival' && !isCorrect) {
        const nextLives = state.lives - 1;
        patchQuiz({ lives: nextLives });
        if (nextLives <= 0) {
          setTimeout(() => finishGame(), 2200);
        }
      }
    } catch (err: any) {
      const status = Number(err?.status) || 0;
      if (status >= 400 && status < 500) {
        alert('Игровая сессия недоступна. Покажем результат без сохранения в рейтинг.');
        finishGame();
        return;
      }
      patchQuiz({ isAnswered: false, selectedAuthorId: null });
      alert('Не удалось проверить ответ. Попробуйте еще раз.');
    }
  }, [applyServerStats, clearTimer, finishGame, patchQuiz]);

  const handleTimeout = useCallback(async () => {
    const state = quizRef.current;
    const question = state.questions[state.currentIdx];
    if (!question || state.isAnswered) return;

    clearTimer();
    patchQuiz({ isAnswered: true, selectedAuthorId: '__timeout__' });
    soundFx.playWrong();

    let resolvedAuthor: any = null;
    try {
      const data = await fetchQuiz({ action: 'timeout', qToken: question.qToken, sessionId: state.sessionId });
      resolvedAuthor = data.correctAuthor || question.options.find((o) => o.id === data.correctAuthorId) || null;
      applyServerStats(data);
      patchQuiz({
        correctAuthorId: data.correctAuthorId || null,
        currentCorrectAuthor: resolvedAuthor,
        lastEarnedPoints: 0,
      });
    } catch {
      const next = { ...statsRef.current, streak: 0 };
      statsRef.current = next;
      patchQuiz({ streak: 0, correctAuthorId: null, currentCorrectAuthor: null, lastEarnedPoints: 0 });
    }

    const historyItem: GameHistoryItem = {
      post: question,
      correctAuthor: {
        name: resolvedAuthor?.name || '—',
        handle: resolvedAuthor?.handle || '—',
      },
      chosenAuthorId: null,
      isCorrect: false,
    };
    historyRef.current = [...historyRef.current, historyItem];
    patchQuiz({ gameHistory: historyRef.current });

    if (state.activeMode === 'survival') {
      const nextLives = state.lives - 1;
      patchQuiz({ lives: nextLives });
      if (nextLives <= 0) {
        setTimeout(() => finishGame(), 2200);
      }
    }
  }, [applyServerStats, clearTimer, finishGame, patchQuiz]);

  const nextQuestion = useCallback(() => {
    const state = quizRef.current;
    const nextIdx = state.currentIdx + 1;
    if (state.activeMode === 'survival' && state.lives <= 0) {
      finishGame();
      return;
    }
    if (nextIdx >= state.questions.length) {
      finishGame();
      return;
    }
    patchQuiz({
      currentIdx: nextIdx,
      isAnswered: false,
      selectedAuthorId: null,
      correctAuthorId: null,
      eliminatedIds: [],
      hintUsed: false,
      showTextHint: false,
      lastEarnedPoints: 0,
      currentCorrectAuthor: null,
      timeLeft: state.maxTime,
    });
  }, [finishGame, patchQuiz]);

  const use5050 = useCallback(() => {
    const state = quizRef.current;
    const question = state.questions[state.currentIdx];
    if (state.hints5050Left <= 0 || state.isAnswered || !question) return;

    let toEliminate: string[] = [];
    try {
      const part = question.qToken.split('.')[0];
      if (part) {
        let b64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        const binary = atob(b64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        if (Array.isArray(payload?.elim) && payload.elim.length > 0) {
          toEliminate = payload.elim.slice(0, 2);
        }
      }
    } catch {}

    if (toEliminate.length === 0) {
      toEliminate = question.options
        .filter((o) => o.id !== state.correctAuthorId)
        .slice(0, 2)
        .map((d) => d.id);
    }

    patchQuiz({
      eliminatedIds: toEliminate,
      hints5050Left: state.hints5050Left - 1,
      hintUsed: true,
    });
  }, [patchQuiz]);

  const useHint = useCallback(() => {
    const state = quizRef.current;
    if (state.textHintsLeft <= 0 || state.isAnswered || state.showTextHint) return;
    patchQuiz({
      showTextHint: true,
      hintUsed: true,
      textHintsLeft: state.textHintsLeft - 1,
    });
  }, [patchQuiz]);

  const skipQuestion = useCallback(() => {
    const state = quizRef.current;
    if (state.activeMode !== 'practice' || state.isAnswered) return;
    nextQuestion();
  }, [nextQuestion]);

  const finishPractice = useCallback(() => {
    finishGame();
  }, [finishGame]);

  useEffect(() => {
    const savedNick = localStorage.getItem('itd_player_nickname');
    if (savedNick) setNickname(savedNick);

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }
  }, []);

  const handleNicknameChange = useCallback((newNick: string) => {
    setNickname(newNick);
    try {
      localStorage.setItem('itd_player_nickname', newNick);
    } catch {}
  }, []);

  useEffect(() => {
    if (quiz.questions.length === 0) return;
    const nextBatch = quiz.questions.slice(quiz.currentIdx, quiz.currentIdx + 4);
    for (const q of nextBatch) {
      if (q && q.screenshot && !preloadedImagesRef.current.has(q.screenshot)) {
        const img = new Image();
        img.src = q.screenshot;
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {});
        }
        preloadedImagesRef.current.set(q.screenshot, img);
      }
    }
    if (preloadedImagesRef.current.size > 20) {
      const keys = Array.from(preloadedImagesRef.current.keys());
      for (let i = 0; i < keys.length - 10; i++) {
        preloadedImagesRef.current.delete(keys[i]);
      }
    }
  }, [quiz.questions, quiz.currentIdx]);

  useEffect(() => {
    if (
      pathname === '/play'
      && !quiz.isAnswered
      && !quiz.isLoadingQuiz
      && quiz.activeMode !== 'practice'
      && quiz.questions.length > 0
    ) {
      timerRef.current = setInterval(() => {
        const current = quizRef.current;
        if (current.timeLeft <= 1) {
          patchQuiz({ timeLeft: 0 });
          handleTimeout();
        } else {
          patchQuiz({ timeLeft: current.timeLeft - 1 });
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pathname, quiz.isAnswered, quiz.isLoadingQuiz, quiz.currentIdx, quiz.activeMode, quiz.questions.length, handleTimeout, patchQuiz]);

  const value: AppContextValue = {
    ...quiz,
    nickname,
    handleNicknameChange,
    selectedMode,
    setSelectedMode,
    isRulesOpen,
    openRules: () => setIsRulesOpen(true),
    closeRules: () => setIsRulesOpen(false),
    isSuggestPostOpen,
    openSuggestPost: () => setIsSuggestPostOpen(true),
    closeSuggestPost: () => setIsSuggestPostOpen(false),
    isSuggestAuthorOpen,
    openSuggestAuthor: () => setIsSuggestAuthorOpen(true),
    closeSuggestAuthor: () => setIsSuggestAuthorOpen(false),
    result,
    submitState,
    startQuiz,
    startTestQuiz,
    selectOption,
    use5050,
    useHint,
    skipQuestion,
    nextQuestion,
    finishGame,
    finishPractice,
    submitResult,
    getMultiplier: getStreakMultiplier,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <SuggestPostModal
        isOpen={isSuggestPostOpen}
        onClose={() => setIsSuggestPostOpen(false)}
        nickname={nickname}
        onOpenSuggestAuthor={() => {
          setIsSuggestPostOpen(false);
          setIsSuggestAuthorOpen(true);
        }}
      />
      <SuggestAuthorModal isOpen={isSuggestAuthorOpen} onClose={() => setIsSuggestAuthorOpen(false)} />
    </AppContext.Provider>
  );
}
