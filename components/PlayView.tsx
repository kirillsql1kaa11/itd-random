'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuizView } from './QuizView';
import { useApp } from './AppProvider';

export function PlayView() {
  const router = useRouter();
  const app = useApp();

  useEffect(() => {
    if (!app.isLoadingQuiz && app.questions.length === 0) {
      router.replace('/');
    }
  }, [app.isLoadingQuiz, app.questions.length, router]);

  if (app.questions.length === 0) {
    return (
      <section className="app-view">
        <div className="quiz-skeleton-card">
          <div className="quiz-skeleton-spinner"></div>
          <span>Загрузка вопроса...</span>
        </div>
      </section>
    );
  }

  const question = app.questions[app.currentIdx] || null;

  return (
    <QuizView
      question={question}
      currentIndex={app.currentIdx}
      totalQuestions={app.questions.length}
      mode={app.activeMode}
      score={app.score}
      streak={app.streak}
      multiplier={app.getMultiplier(app.streak)}
      lives={app.lives}
      timeLeft={app.timeLeft}
      maxTime={app.maxTime}
      isAnswered={app.isAnswered}
      selectedAuthorId={app.selectedAuthorId}
      correctAuthorId={app.correctAuthorId}
      eliminatedIds={app.eliminatedIds}
      hintUsed={app.hintUsed}
      hints5050Left={app.hints5050Left}
      textHintsLeft={app.textHintsLeft}
      showTextHint={app.showTextHint}
      isLoading={app.isLoadingQuiz}
      earnedPoints={app.lastEarnedPoints}
      correctAuthor={app.currentCorrectAuthor}
      onSelectOption={app.selectOption}
      onUse5050={app.use5050}
      onUseHint={app.useHint}
      onNextQuestion={app.nextQuestion}
      onFinishPractice={app.finishPractice}
      onSkip={app.skipQuestion}
    />
  );
}
