'use client';

import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Flame, Target, CheckCircle2, RotateCcw, Home, Download, Check, Share2 } from 'lucide-react';
import { generateShareCard } from '@/lib/sharecard';
import { soundFx } from '@/lib/sound';
import { GameMode } from '@/types';

interface ResultViewProps {
  score: number;
  accuracy: number;
  maxStreak: number;
  correctCount: number;
  totalCount: number;
  mode: GameMode;
  nickname: string;
  sessionToken: string | null;
  onPlayAgain: () => void;
  onGoHome: () => void;
  onLeaderboardSubmitted?: () => void;
}

export function ResultView({
  score,
  accuracy,
  maxStreak,
  correctCount,
  totalCount,
  mode,
  nickname,
  sessionToken,
  onPlayAgain,
  onGoHome,
  onLeaderboardSubmitted,
}: ResultViewProps) {
  const [currentNick, setCurrentNick] = useState(nickname || 'Аноним');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  useEffect(() => {
    if (accuracy >= 60 || score > 500) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0080ff', '#00ba7c', '#f59e0b', '#ec4899'],
        });
      } catch {}
    }
  }, [accuracy, score]);

  const handleSubmitScore = async () => {
    if (!sessionToken || submitted || isSubmitting) return;
    setIsSubmitting(true);
    soundFx.playClick();

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_score',
          sessionToken,
          nickname: currentNick.trim() || 'Аноним',
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        if (onLeaderboardSubmitted) onLeaderboardSubmitted();
      }
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateShareCard = async () => {
    soundFx.playClick();
    setIsGeneratingCard(true);
    try {
      const img = await generateShareCard({
        nickname: currentNick,
        score,
        accuracy,
        streak: maxStreak,
        mode,
      });
      setShareImage(img);
    } catch {
    } finally {
      setIsGeneratingCard(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#0080ff]/15 text-[#0080ff] border border-[#0080ff]/30">
          Игра завершена
        </span>
        <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
          Ваш результат
        </h2>
        <p className="text-sm text-white/50">
          {mode === 'blitz' ? 'Блиц-раунд 10 вопросов' : mode === 'survival' ? 'Режим Выживание' : 'Свободный режим'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#14141c] border border-white/10 text-center">
          <div className="w-8 h-8 rounded-lg bg-[#0080ff]/10 text-[#0080ff] flex items-center justify-center mx-auto mb-2">
            <Trophy size={18} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Очки</span>
          <strong className="font-heading font-extrabold text-2xl text-white">{score}</strong>
        </div>

        <div className="p-4 rounded-2xl bg-[#14141c] border border-white/10 text-center">
          <div className="w-8 h-8 rounded-lg bg-[#00ba7c]/10 text-[#00ba7c] flex items-center justify-center mx-auto mb-2">
            <Target size={18} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Точность</span>
          <strong className="font-heading font-extrabold text-2xl text-white">{accuracy}%</strong>
        </div>

        <div className="p-4 rounded-2xl bg-[#14141c] border border-white/10 text-center">
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center mx-auto mb-2">
            <Flame size={18} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Серия</span>
          <strong className="font-heading font-extrabold text-2xl text-white">{maxStreak}</strong>
        </div>

        <div className="p-4 rounded-2xl bg-[#14141c] border border-white/10 text-center">
          <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={18} />
          </div>
          <span className="block text-[11px] font-semibold text-white/50 uppercase">Ответы</span>
          <strong className="font-heading font-extrabold text-2xl text-white">
            {correctCount}/{totalCount}
          </strong>
        </div>
      </div>

      {sessionToken && !submitted && (
        <div className="p-5 rounded-2xl bg-[#161622] border border-white/10 space-y-3">
          <span className="block text-xs font-semibold text-white/70 uppercase">
            Сохранить в рейтинг игроков
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentNick}
              onChange={(e) => setCurrentNick(e.target.value)}
              placeholder="Ваш никнейм..."
              maxLength={24}
              className="flex-1 bg-[#101015] border border-white/15 focus:border-[#0080ff] rounded-xl px-4 py-2.5 text-white text-sm outline-none"
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitScore}
              className="px-5 py-2.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 shrink-0"
            >
              {isSubmitting ? 'Сохранение...' : 'Отправить'}
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="p-4 rounded-xl bg-[#00ba7c]/15 border border-[#00ba7c]/30 text-center text-sm font-semibold text-[#00ba7c] flex items-center justify-center gap-2">
          <Check size={18} />
          <span>Результат успешно зафиксирован в рейтинге</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full sm:flex-1 py-3.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white font-heading font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <RotateCcw size={16} />
          <span>Сыграть снова</span>
        </button>

        <button
          type="button"
          onClick={handleCreateShareCard}
          disabled={isGeneratingCard}
          className="w-full sm:flex-1 py-3.5 rounded-xl bg-[#14141c] hover:bg-[#1a1a24] border border-white/15 text-white font-heading font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Share2 size={16} />
          <span>{isGeneratingCard ? 'Генерация...' : 'Поделиться'}</span>
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-[#14141c] hover:bg-[#1a1a24] border border-white/15 text-white/70 hover:text-white text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Home size={16} />
          <span>Меню</span>
        </button>
      </div>

      {shareImage && (
        <div className="p-4 rounded-2xl bg-[#121218] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/70 uppercase">
              Карточка для соцсетей
            </span>
            <a
              href={shareImage}
              download={`itd-quiz-${score}pts.png`}
              className="flex items-center gap-1.5 text-xs text-[#0080ff] hover:text-[#3399ff] font-semibold"
            >
              <Download size={14} />
              <span>Скачать PNG</span>
            </a>
          </div>
          <img
            src={shareImage}
            alt="Результат викторины"
            className="w-full rounded-xl border border-white/10 shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
