'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameMode, QuizQuestion, UserStats } from '@/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HomeView } from '@/components/HomeView';
import { QuizView } from '@/components/QuizView';
import { ResultView } from '@/components/ResultView';
import { LeaderboardView } from '@/components/LeaderboardView';
import { AuthorsView } from '@/components/AuthorsView';
import { StatsView } from '@/components/StatsView';
import { AdminView } from '@/components/AdminView';
import { RulesModal } from '@/components/RulesModal';
import { SuggestPostModal } from '@/components/SuggestPostModal';
import { SuggestAuthorModal } from '@/components/SuggestAuthorModal';
import { soundFx } from '@/lib/sound';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [nickname, setNickname] = useState<string>('Аноним');
  const [selectedMode, setSelectedMode] = useState<GameMode>('blitz');

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSuggestPostOpen, setIsSuggestPostOpen] = useState(false);
  const [isSuggestAuthorOpen, setIsSuggestAuthorOpen] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [correctAuthorId, setCorrectAuthorId] = useState<string | null>(null);
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [hints5050Left, setHints5050Left] = useState(1);
  const [textHintsLeft, setTextHintsLeft] = useState(3);
  const [showTextHint, setShowTextHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedNick = localStorage.getItem('itd_player_nickname');
    if (savedNick) setNickname(savedNick);
  }, []);

  const handleNicknameChange = (newNick: string) => {
    setNickname(newNick);
    localStorage.setItem('itd_player_nickname', newNick);
  };

  const getMultiplier = (currentStreak: number) => {
    if (currentStreak >= 8) return 3.0;
    if (currentStreak >= 5) return 2.0;
    if (currentStreak >= 3) return 1.5;
    return 1.0;
  };

  const saveLocalGameStats = (finalScore: number, finalStreak: number, finalCorrect: number, total: number) => {
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
      stats.totalScore += finalScore;
      stats.bestScore = Math.max(stats.bestScore, finalScore);
      stats.maxStreak = Math.max(stats.maxStreak, finalStreak);
      stats.correctAnswers += finalCorrect;
      stats.totalAnswers += total;

      const accuracy = total > 0 ? Math.round((finalCorrect / total) * 100) : 0;
      stats.history.push({
        date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        score: finalScore,
        accuracy,
        mode: selectedMode,
      });

      localStorage.setItem('itd_user_stats', JSON.stringify(stats));
    } catch {}
  };

  const finishGame = useCallback((finalScore: number, finalMaxStreak: number, finalCorrect: number, total: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    saveLocalGameStats(finalScore, finalMaxStreak, finalCorrect, total);
    setActiveTab('result');
  }, [selectedMode]);

  const startQuiz = async () => {
    setIsLoadingQuiz(true);
    setActiveTab('quiz');
    setQuestions([]);
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setLives(3);
    setTimeLeft(15);
    setMaxTime(15);
    setIsAnswered(false);
    setSelectedAuthorId(null);
    setCorrectAuthorId(null);
    setEliminatedIds([]);
    setHintUsed(false);
    setHints5050Left(1);
    setTextHintsLeft(3);
    setShowTextHint(false);
    setCorrectCount(0);
    setSessionToken(null);

    try {
      const res = await fetch(`/api/quiz?action=get_questions&mode=${selectedMode}`);
      const data = await res.json();
      if (data && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setSessionToken(data.sessionToken || null);
      } else {
        alert('Не удалось загрузить вопросы викторины');
        setActiveTab('home');
      }
    } catch {
      alert('Ошибка при запуске игры');
      setActiveTab('home');
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const startTestQuiz = (post: any) => {
    setActiveTab('quiz');
    const testQ: QuizQuestion = {
      id: post.id,
      qToken: `test_${post.id}`,
      screenshot: post.screenshot,
      postText: post.post_text || '',
      hint: post.hint || '',
      difficulty: post.difficulty || 'normal',
      tags: post.tags || [],
      options: [],
    };
    fetch('/api/authors')
      .then((res) => res.json())
      .then((d) => {
        const pool = d.authors || [];
        const correct = pool.find((a: any) => a.id === post.correct_author_id) || {
          id: post.correct_author_id,
          name: post.correct_author_id,
          handle: `@${post.correct_author_id}`,
          avatarColor: 'linear-gradient(135deg, #0288d1, #26c6da)',
          avatarText: '?',
          verified: true,
        };
        const others = pool.filter((a: any) => a.id !== correct.id).sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [correct, ...others].sort(() => Math.random() - 0.5).map((a: any) => ({
          id: a.id,
          name: a.name,
          handle: a.handle,
          avatarColor: a.avatar_color || a.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)',
          avatarText: a.avatar_text || a.avatarText || (a.name ? a.name[0] : '?'),
          verified: Boolean(a.verified),
        }));
        testQ.options = options;
        setQuestions([testQ]);
        setCurrentIdx(0);
        setScore(0);
        setStreak(0);
        setMaxStreak(0);
        setLives(3);
        setTimeLeft(15);
        setMaxTime(15);
        setIsAnswered(false);
        setSelectedAuthorId(null);
        setCorrectAuthorId(null);
        setEliminatedIds([]);
        setHintUsed(false);
        setHints5050Left(1);
        setTextHintsLeft(3);
        setShowTextHint(false);
        setCorrectCount(0);
        setSessionToken(null);
      })
      .catch(() => {});
  };

  const handleNextQuestion = useCallback((nextIdx: number, currentLives: number, currentScore: number, currentMaxStreak: number, currentCorrect: number) => {
    if (selectedMode === 'survival' && currentLives <= 0) {
      finishGame(currentScore, currentMaxStreak, currentCorrect, nextIdx);
      return;
    }

    if (nextIdx >= questions.length) {
      finishGame(currentScore, currentMaxStreak, currentCorrect, questions.length);
      return;
    }

    setCurrentIdx(nextIdx);
    setIsAnswered(false);
    setSelectedAuthorId(null);
    setCorrectAuthorId(null);
    setEliminatedIds([]);
    setHintUsed(false);
    setShowTextHint(false);
    setTimeLeft(15);
    setMaxTime(15);
  }, [questions.length, selectedMode, finishGame]);

  const handleSelectOption = async (chosenAuthorId: string) => {
    if (isAnswered || !questions[currentIdx]) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setIsAnswered(true);
    setSelectedAuthorId(chosenAuthorId);

    const q = questions[currentIdx];
    let isCorrect = false;
    let earnedPoints = 0;
    let verifiedCorrectId = chosenAuthorId;

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_answer',
          qToken: q.qToken,
          selectedAuthorId: chosenAuthorId,
          sessionToken,
          timeLeft,
          hintUsed,
        }),
      });

      const data = await res.json();
      if (res.ok && data) {
        isCorrect = Boolean(data.isCorrect);
        earnedPoints = Number(data.pointsEarned) || 0;
        verifiedCorrectId = data.correctAuthorId || chosenAuthorId;
        if (data.sessionToken) setSessionToken(data.sessionToken);
      }
    } catch {
      isCorrect = true;
    }

    setCorrectAuthorId(verifiedCorrectId);

    let nextScore = score;
    let nextStreak = streak;
    let nextMaxStreak = maxStreak;
    let nextLives = lives;
    let nextCorrect = correctCount;

    if (isCorrect) {
      soundFx.playCorrect();
      nextScore += earnedPoints;
      nextStreak += 1;
      if (nextStreak > nextMaxStreak) nextMaxStreak = nextStreak;
      nextCorrect += 1;
      if (nextStreak >= 3) soundFx.playStreak();
    } else {
      soundFx.playWrong();
      nextStreak = 0;
      if (selectedMode === 'survival') {
        nextLives -= 1;
      }
    }

    setScore(nextScore);
    setStreak(nextStreak);
    setMaxStreak(nextMaxStreak);
    setLives(nextLives);
    setCorrectCount(nextCorrect);

    setTimeout(() => {
      handleNextQuestion(currentIdx + 1, nextLives, nextScore, nextMaxStreak, nextCorrect);
    }, 1200);
  };

  const handleTimeout = useCallback(() => {
    if (isAnswered || !questions[currentIdx]) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setIsAnswered(true);
    setSelectedAuthorId('__timeout__');
    soundFx.playWrong();

    let nextLives = lives;
    if (selectedMode === 'survival') {
      nextLives -= 1;
      setLives(nextLives);
    }
    setStreak(0);

    setTimeout(() => {
      handleNextQuestion(currentIdx + 1, nextLives, score, maxStreak, correctCount);
    }, 1200);
  }, [isAnswered, questions, currentIdx, lives, selectedMode, score, maxStreak, correctCount, handleNextQuestion]);

  useEffect(() => {
    if (activeTab === 'quiz' && !isAnswered && !isLoadingQuiz && selectedMode !== 'practice') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab, isAnswered, isLoadingQuiz, currentIdx, selectedMode, handleTimeout]);

  const handleUse5050 = () => {
    if (hints5050Left <= 0 || isAnswered || !questions[currentIdx]) return;
    const q = questions[currentIdx];
    const distractors = q.options.filter((o) => o.id !== correctAuthorId);
    const toEliminate = distractors.slice(0, 2).map((d) => d.id);
    setEliminatedIds(toEliminate);
    setHints5050Left((prev) => prev - 1);
  };

  const handleUseHint = () => {
    if (textHintsLeft <= 0 || isAnswered || showTextHint) return;
    setShowTextHint(true);
    setHintUsed(true);
    setTextHintsLeft((prev) => prev - 1);
  };

  const handleSkipQuestion = () => {
    if (selectedMode !== 'practice' || isAnswered) return;
    handleNextQuestion(currentIdx + 1, lives, score, maxStreak, correctCount);
  };

  const totalAnswered = currentIdx + (isAnswered ? 1 : 0);
  const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        activeTab={activeTab}
        onTabChange={(t) => {
          if (timerRef.current) clearInterval(timerRef.current);
          setActiveTab(t);
        }}
        onOpenRules={() => setIsRulesOpen(true)}
      />

      <main className="main-content">
        {activeTab === 'home' && (
          <HomeView
            nickname={nickname}
            onNicknameChange={handleNicknameChange}
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            onStartGame={startQuiz}
            onOpenSuggestPost={() => setIsSuggestPostOpen(true)}
            onOpenAuthors={() => setActiveTab('authors')}
            onOpenLeaderboard={() => setActiveTab('leaderboard')}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizView
            question={questions[currentIdx] || null}
            currentIndex={currentIdx}
            totalQuestions={questions.length}
            mode={selectedMode}
            score={score}
            streak={streak}
            multiplier={getMultiplier(streak)}
            lives={lives}
            timeLeft={timeLeft}
            maxTime={maxTime}
            isAnswered={isAnswered}
            selectedAuthorId={selectedAuthorId}
            correctAuthorId={correctAuthorId}
            eliminatedIds={eliminatedIds}
            hintUsed={hintUsed}
            hints5050Left={hints5050Left}
            textHintsLeft={textHintsLeft}
            showTextHint={showTextHint}
            isLoading={isLoadingQuiz}
            onSelectOption={handleSelectOption}
            onUse5050={handleUse5050}
            onUseHint={handleUseHint}
            onSkip={handleSkipQuestion}
          />
        )}

        {activeTab === 'result' && (
          <ResultView
            score={score}
            accuracy={accuracy}
            maxStreak={maxStreak}
            correctCount={correctCount}
            totalCount={totalAnswered}
            mode={selectedMode}
            nickname={nickname}
            sessionToken={sessionToken}
            onPlayAgain={startQuiz}
            onGoHome={() => setActiveTab('home')}
            onLeaderboardSubmitted={() => setActiveTab('leaderboard')}
          />
        )}

        {activeTab === 'leaderboard' && <LeaderboardView />}

        {activeTab === 'authors' && (
          <AuthorsView onOpenSuggestAuthor={() => setIsSuggestAuthorOpen(true)} />
        )}

        {activeTab === 'stats' && <StatsView />}

        {activeTab === 'admin' && (
          <AdminView
            onGoHome={() => setActiveTab('home')}
            onTestQuestion={startTestQuiz}
          />
        )}
      </main>

      <Footer onOpenAdmin={() => setActiveTab('admin')} />

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
      <SuggestAuthorModal
        isOpen={isSuggestAuthorOpen}
        onClose={() => setIsSuggestAuthorOpen(false)}
      />
    </div>
  );
}
