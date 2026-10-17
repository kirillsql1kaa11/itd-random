'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ResultView } from './ResultView';
import { useApp } from './AppProvider';

export function ResultPage() {
  const router = useRouter();
  const app = useApp();
  const { result, submitState, submitResult } = app;

  useEffect(() => {
    if (!result) {
      router.replace('/');
    }
  }, [result, router]);

  useEffect(() => {
    if (result && !result.isTest) {
      submitResult();
    }
  }, [result, submitResult]);

  if (!result) {
    return (
      <section className="app-view">
        <div className="quiz-skeleton-card">
          <div className="quiz-skeleton-spinner"></div>
          <span>Загрузка результата...</span>
        </div>
      </section>
    );
  }

  return (
    <ResultView
      score={result.score}
      accuracy={result.accuracy}
      maxStreak={result.maxStreak}
      correctCount={result.correctCount}
      totalCount={result.totalCount}
      mode={result.mode}
      nickname={app.nickname}
      isTest={result.isTest}
      submitState={submitState}
      history={result.history}
      onPlayAgain={app.startQuiz}
      onGoHome={() => router.push('/')}
      onGoLeaderboard={() => router.push('/leaderboard')}
      onRetrySubmit={submitResult}
    />
  );
}
