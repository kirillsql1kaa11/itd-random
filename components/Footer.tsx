'use client';

import React from 'react';

interface FooterProps {
  onOpenAdmin: () => void;
}

export function Footer({ onOpenAdmin }: FooterProps) {
  return (
    <footer className="app-footer">
      <span>ИТД: Угадай Автора</span>
      <span>•</span>
      <span>
        Автор:{' '}
        <a
          href="https://xn--d1ah4a.com/@l1kaa11"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          @l1kaa11 (ИТД) ↗
        </a>
      </span>
      <span>•</span>
      <a
        href="https://xn--d1ah4a.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="footer-link"
      >
        итд.com ↗
      </a>
      <span>•</span>
      <button
        type="button"
        className="footer-admin-btn"
        onClick={onOpenAdmin}
      >
        Панель управления
      </button>
    </footer>
  );
}
