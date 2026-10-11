'use client';

import React, { useEffect, useState } from 'react';
import { QuizQuestion, GameMode } from '@/types';
import { Heart, Clock, Zap, CheckCircle2, XCircle, Lightbulb, Split, SkipForward, BadgeCheck } from 'lucide-react';
import { soundFx } from '@/lib/sound';

interface QuizViewProps {
  question: QuizQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  mode: GameMode;
  score: number;
  streak: number;
  multiplier: number;
  lives: number;
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
  isLoading: boolean;
  onSelectOption: (authorId: string) => void;
  onUse5050: () => void;
  onUseHint: () => void;
  onSkip?: () => void;
}

export function QuizView({
  question,
  currentIndex,
  totalQuestions,
  mode,
  score,
  streak,
  multiplier,
  lives,
  timeLeft,
  maxTime,
  isAnswered,
  selectedAuthorId,
  correctAuthorId,
  eliminatedIds,
  hintUsed,
  hints5050Left,
  textHintsLeft,
  showTextHint,
  isLoading,
  onSelectOption,
  onUse5050,
  onUseHint,
  onSkip,
}: QuizViewProps) {
  const [zoomImage, setZoomImage] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnswered || isLoading || !question) return;
      const key = e.key;
      if (['1', '2', '3', '4'].includes(key)) {
        const idx = parseInt(key, 10) - 1;
        const opt = question.options[idx];
        if (opt && !eliminatedIds.includes(opt.id)) {
          soundFx.playClick();
          onSelectOption(opt.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, isLoading, question, eliminatedIds, onSelectOption]);

  if (isLoading || !question) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-12 h-12 border-4 border-[#0080ff]/20 border-t-[#0080ff] rounded-full animate-spin"></div>
        <p className="text-white/60 font-medium text-sm">Подготовка вопроса...</p>
      </div>
    );
  }

  const timerPercent = maxTime > 0 ? (timeLeft / maxTime) * 100 : 100;
  const timerColor = timeLeft <= 5 ? '#ef4444' : timeLeft <= 8 ? '#f59e0b' : '#00ba7c';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#121218] border border-white/10">
        <div className="flex items-center gap-5">
          <div>
            <span className="block text-[11px] font-semibold text-white/40 uppercase">Очки</span>
            <span className="font-heading font-extrabold text-xl text-white tracking-wide">
              {score}
            </span>
          </div>

          <div className="h-8 w-px bg-white/10"></div>

          <div>
            <span className="block text-[11px] font-semibold text-white/40 uppercase">Серия</span>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-extrabold text-xl text-white">{streak}</span>
              {multiplier > 1 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                  x{multiplier}
                </span>
              )}
            </div>
          </div>

          {mode === 'survival' && (
            <>
              <div className="h-8 w-px bg-white/10"></div>
              <div>
                <span className="block text-[11px] font-semibold text-white/40 uppercase">Жизни</span>
                <div className="flex items-center gap-1 mt-0.5">
                  {[1, 2, 3].map((heartIndex) => (
                    <Heart
                      key={heartIndex}
                      size={18}
                      className={
                        heartIndex <= lives
                          ? 'text-[#ef4444] fill-[#ef4444]'
                          : 'text-white/20 fill-none'
                      }
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-5">
          {mode !== 'practice' && (
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-white/40" />
              <div className="w-24 sm:w-32 bg-white/10 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{
                    width: `${timerPercent}%`,
                    backgroundColor: timerColor,
                  }}
                ></div>
              </div>
              <span
                className="font-heading font-bold text-sm w-6 text-right"
                style={{ color: timerColor }}
              >
                {timeLeft}
              </span>
            </div>
          )}

          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/70">
            {mode === 'survival' ? `Раунд ${currentIndex + 1}` : `${currentIndex + 1} / ${totalQuestions}`}
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl bg-[#14141c] border border-white/10 overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-6 bg-gradient-to-b from-[#181824] to-[#14141c]">
          {question.screenshot ? (
            <div className="relative flex justify-center items-center rounded-xl overflow-hidden bg-black/40 border border-white/5 max-h-[460px]">
              <img
                src={question.screenshot}
                alt="Пост ИТД"
                onClick={() => setZoomImage(true)}
                className="w-auto max-h-[450px] object-contain cursor-zoom-in hover:scale-[1.01] transition-transform"
              />
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#0c0c10] border border-white/10 text-center space-y-4">
              <p className="text-lg md:text-xl text-white font-medium leading-relaxed">
                "{question.postText}"
              </p>
              {question.tags && question.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {question.tags.map((tag, i) => (
                    <span key={i} className="text-xs text-[#0080ff] font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {showTextHint && question.hint && (
            <div className="mt-4 p-3.5 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-start gap-2.5">
              <Lightbulb size={18} className="text-[#f59e0b] shrink-0 mt-0.5" />
              <p className="text-xs text-[#f59e0b] leading-relaxed">
                Подсказка: {question.hint}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isAnswered || hints5050Left <= 0}
            onClick={() => {
              soundFx.playClick();
              onUse5050();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              hints5050Left > 0 && !isAnswered
                ? 'bg-[#14141c] border-white/15 text-white hover:border-[#0080ff] hover:text-[#0080ff]'
                : 'bg-white/5 border-transparent text-white/30 cursor-not-allowed'
            }`}
          >
            <Split size={14} />
            <span>50:50 ({hints5050Left})</span>
          </button>

          {question.hint && (
            <button
              type="button"
              disabled={isAnswered || textHintsLeft <= 0 || showTextHint}
              onClick={() => {
                soundFx.playClick();
                onUseHint();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                textHintsLeft > 0 && !isAnswered && !showTextHint
                  ? 'bg-[#14141c] border-white/15 text-white hover:border-[#f59e0b] hover:text-[#f59e0b]'
                  : 'bg-white/5 border-transparent text-white/30 cursor-not-allowed'
              }`}
            >
              <Lightbulb size={14} />
              <span>Подсказка ({textHintsLeft})</span>
            </button>
          )}
        </div>

        {mode === 'practice' && onSkip && (
          <button
            type="button"
            disabled={isAnswered}
            onClick={() => {
              soundFx.playClick();
              onSkip();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#14141c] border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer"
          >
            <SkipForward size={14} />
            <span>Пропустить</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {question.options.map((opt, idx) => {
          const isEliminated = eliminatedIds.includes(opt.id);
          const isSelected = selectedAuthorId === opt.id;
          const isCorrect = correctAuthorId === opt.id;
          const isWrong = isSelected && correctAuthorId && !isCorrect;

          let btnClass = 'bg-[#14141c] border-white/10 hover:border-white/25 hover:bg-[#1a1a24] text-white';
          if (isEliminated) {
            btnClass = 'bg-white/5 border-transparent text-white/20 line-through cursor-not-allowed pointer-events-none';
          } else if (isAnswered) {
            if (isCorrect) {
              btnClass = 'bg-[#00ba7c]/20 border-[#00ba7c] text-white shadow-[0_0_20px_rgba(0,186,124,0.4)]';
            } else if (isWrong) {
              btnClass = 'bg-[#ef4444]/20 border-[#ef4444] text-white animate-shake shadow-[0_0_20px_rgba(239,68,68,0.4)]';
            } else {
              btnClass = 'bg-white/5 border-transparent text-white/30 pointer-events-none';
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isAnswered || isEliminated}
              onClick={() => {
                soundFx.playClick();
                onSelectOption(opt.id);
              }}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer ${btnClass}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-heading font-bold text-white/70 shrink-0">
                  {idx + 1}
                </span>

                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm"
                  style={{ background: opt.avatarColor || 'linear-gradient(135deg, #0288d1, #26c6da)' }}
                >
                  {opt.avatarText || opt.name[0] || '?'}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-sm font-semibold truncate text-white">
                      {opt.name}
                    </strong>
                    {opt.verified && (
                      <BadgeCheck size={14} className="text-[#0080ff] shrink-0" />
                    )}
                  </div>
                  <span className="block text-xs text-white/50 truncate">
                    {opt.handle}
                  </span>
                </div>
              </div>

              {isAnswered && isCorrect && (
                <CheckCircle2 size={20} className="text-[#00ba7c] shrink-0" />
              )}
              {isAnswered && isWrong && (
                <XCircle size={20} className="text-[#ef4444] shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {zoomImage && question.screenshot && (
        <div
          onClick={() => setZoomImage(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img
            src={question.screenshot}
            alt="Пост ИТД"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
