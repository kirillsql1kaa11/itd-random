'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, HelpCircle, Shield, Trophy, Users, BarChart3, Home } from 'lucide-react';
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
    { id: 'admin', label: 'Админка', icon: Shield },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#08080a]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <button
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#0080ff] shadow-[0_0_8px_#0080ff]"></span>
          <span className="font-heading font-bold text-sm tracking-wide text-white">
            ИТД <span className="font-normal text-white/50">· КТО АВТОР?</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-1 bg-[#121216] p-1 rounded-full border border-white/10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  soundFx.playClick();
                  onTabChange(item.id);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0080ff] text-white shadow-[0_0_12px_rgba(0,128,255,0.4)]'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRules}
            title="Правила игры"
            className="p-2 rounded-full bg-[#121216] border border-white/10 text-white/70 hover:text-white hover:border-white/25 transition-all cursor-pointer"
          >
            <HelpCircle size={18} />
          </button>

          <button
            onClick={handleToggleSound}
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
            className="p-2 rounded-full bg-[#121216] border border-white/10 text-white/70 hover:text-white hover:border-white/25 transition-all cursor-pointer"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-[#0080ff]" />}
          </button>
        </div>
      </div>

      <div className="md:hidden flex items-center justify-around border-t border-white/5 py-2 px-2 bg-[#0d0d12]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                soundFx.playClick();
                onTabChange(item.id);
              }}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#0080ff]' : 'text-white/60 hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
