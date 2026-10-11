'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, HelpCircle, Trophy, Users, BarChart3, Home } from 'lucide-react';
import { soundFx } from '@/lib/sound';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenRules: () => void;
}

export function Header({ activeTab, onTabChange, onOpenRules }: HeaderProps) {
  const [isMuted, setIsMuted] = useState(() => soundFx.isMuted());

  const handleToggleSound = () => {
    const nextMuted = soundFx.toggleMute();
    setIsMuted(nextMuted);
  };

  const navItems = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'leaderboard', label: 'Рейтинг', icon: Trophy },
    { id: 'authors', label: 'Авторы', icon: Users },
    { id: 'stats', label: 'Статистика', icon: BarChart3 },
  ];

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="logo-group">
          <a
            href="#"
            className="logo-badge"
            onClick={(e) => {
              e.preventDefault();
              onTabChange('home');
            }}
          >
            <span className="logo-dot"></span>
            ИТД <span style={{ fontWeight: 400, opacity: 0.6 }}>· КТО АВТОР?</span>
          </a>
        </div>

        <nav className="nav-tabs" aria-label="Основная навигация">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  soundFx.playClick();
                  onTabChange(item.id);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="header-controls">
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenRules}
            title="Правила игры"
          >
            <HelpCircle size={16} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={handleToggleSound}
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} style={{ color: 'var(--accent-blue)' }} />}
          </button>
        </div>
      </div>
    </header>
  );
}
