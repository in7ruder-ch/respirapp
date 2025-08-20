// components/BottomNav.jsx
'use client';

import React from 'react';
import '@/styles/BottomNav.css';

export default function BottomNav({
  active = 'home',               // 'home' | 'library' | 'p1' | 'p2'
  onHome,
  onLibrary,
  onPlaceholder1,
  onPlaceholder2,
}) {
  const Item = ({ id, label, emoji, onClick }) => (
    <button
      className={`bn-item ${active === id ? 'is-active' : ''}`}
      aria-label={label}
      onClick={onClick}
      type="button"
    >
      <span className="bn-icon" aria-hidden="true">{emoji}</span>
      <span className="bn-label">{label}</span>
    </button>
  );

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación inferior">
      <Item id="home"     label="Inicio"     emoji="🏠" onClick={onHome} />
      <Item id="library"  label="Biblioteca" emoji="🎬" onClick={onLibrary} />
      <Item id="p1"       label="Explorar"   emoji="🧭" onClick={onPlaceholder1} />
      <Item id="p2"       label="Perfil"     emoji="👤" onClick={onPlaceholder2} />
    </nav>
  );
}
