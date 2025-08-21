// components/BreathingSelector.jsx
'use client';

import React, { useState, useEffect } from 'react';
import Breathing from './Breathing';
import '@/styles/BreathingSelector.css'; // estilos del launcher 2x2

const TECHNIQUES = {
  diafragmatica: {
    name: '🌬️ Diafragmática',
    phases: [
      { label: 'Inhalá', className: 'inhalá', duration: 4000, scale: 1.4, color: '#60a5fa' },
      { label: 'Exhalá', className: 'exhalá', duration: 6000, scale: 1, color: '#6ee7b7' }
    ]
  },
  '4-7-8': {
    name: '🧘 4-7-8',
    phases: [
      { label: 'Inhalá', className: 'inhalá', duration: 4000, scale: 1.4, color: '#60a5fa' },
      { label: 'Mantené', className: 'mantené', duration: 7000, scale: 1.4, color: '#fde68a' },
      { label: 'Exhalá', className: 'exhalá', duration: 8000, scale: 1, color: '#6ee7b7' }
    ]
  },
  box: {
    name: '📦 Box Breathing',
    phases: [
      { label: 'Inhalá', className: 'inhalá', duration: 4000, scale: 1.4, color: '#60a5fa' },
      { label: 'Mantené', className: 'mantené', duration: 4000, scale: 1.4, color: '#fde68a' },
      { label: 'Exhalá', className: 'exhalá', duration: 4000, scale: 1, color: '#6ee7b7' },
      { label: 'Vacío', className: 'vacío', duration: 4000, scale: 1, color: '#e0e7ff' }
    ]
  },
  '3-3-6': {
    name: '🌀 3-3-6',
    phases: [
      { label: 'Inhalá', className: 'inhalá', duration: 3000, scale: 1.4, color: '#60a5fa' },
      { label: 'Mantené', className: 'mantené', duration: 3000, scale: 1.4, color: '#fde68a' },
      { label: 'Exhalá', className: 'exhalá', duration: 6000, scale: 1, color: '#6ee7b7' }
    ]
  },
  conteo: {
    name: '✋ Conteo simple',
    phases: [
      { label: 'Uno', className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
      { label: 'Dos', className: 'exhalá', duration: 2000, scale: 1, color: '#6ee7b7' },
      { label: 'Tres', className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
      { label: 'Cuatro', className: 'exhalá', duration: 2000, scale: 1, color: '#6ee7b7' },
      { label: 'Cinco', className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
      { label: 'Seis', className: 'exhalá', duration: 2000, scale: 1, color: '#6ee7b7' },
      { label: 'Siete', className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
      { label: 'Ocho', className: 'exhalá', duration: 2000, scale: 1, color: '#6ee7b7' },
      { label: 'Nueve', className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
      { label: 'Diez', className: 'exhalá', duration: 2000, scale: 1, color: '#6ee7b7' }
    ]
  }
};

export default function BreathingSelector({ onBack, setAppTitle }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (selected && typeof setAppTitle === 'function') {
      setAppTitle(TECHNIQUES[selected]?.name ?? 'Técnica de respiración');
    } else if (!selected && typeof setAppTitle === 'function') {
      setAppTitle('Elegí una técnica de respiración');
    }
  }, [selected, setAppTitle]);

  // helper para separar emoji del nombre (visual/semántico)
  const splitName = (name) => {
    if (!name) return { emoji: '', label: '' };
    const parts = name.split(' ');
    const emoji = parts.shift() || '';
    const label = parts.join(' ');
    return { emoji, label };
  };

  return (
    <div className="breathing-selector">
      {selected ? (
        <div className="breathing-exercise">
          <Breathing
            phases={TECHNIQUES[selected]?.phases ?? []}
            onBack={() => setSelected(null)}
          />
        </div>
      ) : (
        <div className="breathing-menu">
          <div className="selector-buttons" role="list" aria-label="Técnicas de respiración">
            {Object.entries(TECHNIQUES).map(([key, val], idx) => {
              const { emoji, label } = splitName(val.name);
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`technique-button color-${idx + 1}`}
                  role="listitem"
                  aria-label={val.name}
                >
                  <span className="technique-emoji" aria-hidden="true">{emoji}</span>
                  <span className="technique-label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
