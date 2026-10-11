'use client';

import React from 'react';
import { X, Flame, Clock, Heart, Zap, Keyboard } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-[#121218] border border-white/10 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="font-heading font-extrabold text-xl text-white">Правила игры</h3>
            <p className="text-xs text-white/50">Как играть и зарабатывать максимум очков</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-white/70">
          <div className="p-4 rounded-2xl bg-[#161622] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Zap size={16} className="text-[#0080ff]" />
              <span>Суть викторины</span>
            </div>
            <p className="leading-relaxed text-white/60 text-xs">
              Вам показывается скриншот реального поста из соцсети ИТД с замазанным именем автора. Выберите правильного создателя из 4 предложенных вариантов.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#161622] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Flame size={16} className="text-[#f59e0b]" />
              <span>Очки и серии (Streak)</span>
            </div>
            <ul className="space-y-1 text-white/60 text-xs list-disc pl-4">
              <li>Базовая награда: 100 очков за верный ответ</li>
              <li>Бонус за скорость: до +50 очков за быстрый клик</li>
              <li>Множитель серии: серия из 3 верных дает x1.5, из 5 дает x2.0, из 8 дает x3.0</li>
              <li>Ошибочный ответ сбрасывает текущую серию в 0</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-[#161622] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Heart size={16} className="text-[#ef4444]" />
              <span>Режимы игры</span>
            </div>
            <ul className="space-y-1 text-white/60 text-xs list-disc pl-4">
              <li><strong className="text-white">Блиц 10:</strong> 10 вопросов на очки с таймером 15 секунд на каждый</li>
              <li><strong className="text-white">Выживание:</strong> игра идет до 3 ошибок, вопросы усложняются</li>
              <li><strong className="text-white">Свободный:</strong> игра без таймера и штрафов для тренировки</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-[#161622] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Keyboard size={16} className="text-[#00ba7c]" />
              <span>Горячие клавиши</span>
            </div>
            <p className="leading-relaxed text-white/60 text-xs">
              Для быстрого выбора ответа нажимайте клавиши 1, 2, 3 и 4 на клавиатуре.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-[#0080ff] hover:bg-[#1a8cff] text-white font-semibold text-xs transition-all cursor-pointer"
        >
          Понятно, к игре
        </button>
      </div>
    </div>
  );
}
