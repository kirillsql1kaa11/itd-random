'use client';

import React from 'react';
import { Zap, Flame, Heart, Keyboard } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      id="modal-rules"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ maxWidth: 540 }}>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="modal-title">Правила игры</h2>
        <p className="modal-subtitle">Как играть и зарабатывать максимум очков в викторине ИТД</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              <Zap size={16} color="var(--accent-blue)" />
              <span>Суть викторины</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Вам показывается скриншот реального поста из соцсети ИТД с замазанным именем автора. Выберите правильного создателя из 4 предложенных вариантов.
            </p>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              <Flame size={16} color="var(--accent-amber)" />
              <span>Очки и серии (Streak)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>Базовая награда: <strong style={{ color: 'var(--text-primary)' }}>100 очков</strong> за верный ответ</li>
              <li>Бонус за скорость: <strong style={{ color: 'var(--text-primary)' }}>до +50 очков</strong> за быстрый клик</li>
              <li>Множитель серии: серия из 3 дает <strong style={{ color: 'var(--accent-amber)' }}>x1.5</strong>, из 5 дает <strong style={{ color: 'var(--accent-amber)' }}>x2.0</strong>, из 8 дает <strong style={{ color: 'var(--accent-amber)' }}>x3.0</strong></li>
              <li>Ошибочный ответ сбрасывает текущую серию в 0</li>
            </ul>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              <Heart size={16} color="var(--accent-danger)" />
              <span>Режимы игры</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><strong style={{ color: 'var(--text-primary)' }}>Блиц 10:</strong> 10 вопросов на очки с таймером 15 секунд на каждый</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>Выживание:</strong> игра идет до 3 ошибок</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>Свободный:</strong> игра без таймера и штрафов для тренировки</li>
            </ul>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              <Keyboard size={16} color="var(--accent-green)" />
              <span>Горячие клавиши</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><strong style={{ color: 'var(--text-primary)' }}>1, 2, 3, 4:</strong> выбор варианта ответа</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>Пробел / Enter:</strong> следующий вопрос</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>H:</strong> подсказка автора (-30 очков)</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>F / 5:</strong> подсказка 50/50 (-30 очков)</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>Z:</strong> приблизить скриншот поста</li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-primary-action"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Понятно, к игре
        </button>
      </div>
    </div>
  );
}
