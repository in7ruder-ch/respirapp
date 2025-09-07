// components/BreathingSelector.jsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Breathing from './Breathing';
import '@/styles/BreathingSelector.css';
import { useTranslations } from 'next-intl';

export default function BreathingSelector({ onBack, setAppTitle }) {
  const tSel = useTranslations('breathingsel');

  const EMOJI = {
    diaphragmatic: '🌬️',
    '478': '🧘',
    box: '📦',
    '336': '🌀',
    countSimple: '✋',
  };

  const TECHNIQUES = useMemo(() => ({
    diaphragmatic: {
      name: `${EMOJI.diaphragmatic} ${tSel('techs.diaphragmatic')}`,
      phases: [
        { label: tSel('phase.inhale'), className: 'inhalá', duration: 4000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('phase.exhale'), className: 'exhalá', duration: 6000, scale: 1,   color: '#6ee7b7' }
      ]
    },
    '478': {
      name: `${EMOJI['478']} ${tSel('techs.478')}`,
      phases: [
        { label: tSel('phase.inhale'), className: 'inhalá', duration: 4000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('phase.hold'),   className: 'mantené', duration: 7000, scale: 1.4, color: '#fde68a' },
        { label: tSel('phase.exhale'), className: 'exhalá',  duration: 8000, scale: 1,   color: '#6ee7b7' }
      ]
    },
    box: {
      name: `${EMOJI.box} ${tSel('techs.box')}`,
      phases: [
        { label: tSel('phase.inhale'), className: 'inhalá', duration: 4000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('phase.hold'),   className: 'mantené', duration: 4000, scale: 1.4, color: '#fde68a' },
        { label: tSel('phase.exhale'), className: 'exhalá',  duration: 4000, scale: 1,   color: '#6ee7b7' },
        { label: tSel('phase.empty'),  className: 'vacío',   duration: 4000, scale: 1,   color: '#e0e7ff' }
      ]
    },
    '336': {
      name: `${EMOJI['336']} ${tSel('techs.336')}`,
      phases: [
        { label: tSel('phase.inhale'), className: 'inhalá', duration: 3000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('phase.hold'),   className: 'mantené', duration: 3000, scale: 1.4, color: '#fde68a' },
        { label: tSel('phase.exhale'), className: 'exhalá',  duration: 6000, scale: 1,   color: '#6ee7b7' }
      ]
    },
    countSimple: {
      name: `${EMOJI.countSimple} ${tSel('techs.countSimple')}`,
      phases: [
        { label: tSel('count.1'),  className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('count.2'),  className: 'exhalá', duration: 2000, scale: 1,   color: '#6ee7b7' },
        { label: tSel('count.3'),  className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('count.4'),  className: 'exhalá', duration: 2000, scale: 1,   color: '#6ee7b7' },
        { label: tSel('count.5'),  className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('count.6'),  className: 'exhalá', duration: 2000, scale: 1,   color: '#6ee7b7' },
        { label: tSel('count.7'),  className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('count.8'),  className: 'exhalá', duration: 2000, scale: 1,   color: '#6ee7b7' },
        { label: tSel('count.9'),  className: 'inhalá', duration: 2000, scale: 1.4, color: '#60a5fa' },
        { label: tSel('count.10'), className: 'exhalá', duration: 2000, scale: 1,   color: '#6ee7b7' }
      ]
    }
  }), [tSel]);

  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (typeof setAppTitle !== 'function') return;
    if (selected) {
      setAppTitle(TECHNIQUES[selected]?.name ?? tSel('techs.generic'));
    } else {
      setAppTitle(tSel('pickOne'));
    }
  }, [selected, setAppTitle, TECHNIQUES, tSel]);

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
          <div className="selector-buttons" role="list">
            {Object.entries(TECHNIQUES).map(([key, val], idx) => {
              const { emoji, label } = splitName(val.name);
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`technique-button color-${idx + 1}`}
                  role="listitem"
                >
                  <span className="technique-emoji">{emoji}</span>
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
