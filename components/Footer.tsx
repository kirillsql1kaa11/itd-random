'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
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
      <Link href="/admin" className="footer-admin-btn">
        Панель управления
      </Link>
    </footer>
  );
}
