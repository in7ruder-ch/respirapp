// components/Breathing.jsx
'use client';

import React, { useEffect, useState } from 'react';
import '@/styles/Breathing.css';
import { useTranslations } from 'next-intl';

export default function Breathing({ phases = [], onBack }) {
  const tB = useTranslations('breathing');
  const tCommon = useTranslations('common');

  // Duración inicial (en segundos) desde la primera fase si existe
  const initialSeconds = phases?.[0]?.duration ? Math.round(phases[0].duration / 1000) : 0;

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);

  useEffect(() => {
    if (!Array.isArray(phases) || phases.length === 0) return;

    const current = phases[phaseIndex];
    const currentSeconds = Math.max(0, Math.round((current?.duration ?? 0) / 1000));
    setTimeLeft(currentSeconds);

    // Timer de cuenta regresiva (segundos)
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cambio de fase al terminar la duración de la actual
    const timeout = setTimeout(() => {
      setPhaseIndex((prev) => (prev + 1) % phases.length);
    }, current?.duration ?? 0);

    return () => {
      clearTimeout(timeout);
      clearInterval(timer);
    };
  }, [phaseIndex, phases]);

  if (!Array.isArray(phases) || phases.length === 0) {
    return (
      <div className="breathing-container">
        <p className="instruction">{tB('noPhases')}</p>
        {onBack && (
          <span className="back-link" onClick={onBack}>
            ← {tCommon('back')}
          </span>
        )}
      </div>
    );
  }

  const currentPhase = phases[phaseIndex] ?? {};
  const { className = '', color = '#ccc', duration = 0, label = '' } = currentPhase;

  return (
    <div className="breathing-container">
      <div
        className={`circle ${className}`}
        style={{
          backgroundColor: color,
          animationDuration: `${duration}ms`,
          // 👉 Evita que el flex la deforme: siempre círculo perfecto
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          overflow: 'hidden',
        }}
      >
        <span className="countdown">{timeLeft}</span>
      </div>

      <p className="instruction" key={label}>
        {label}
      </p>

      {onBack && (
        <span className="back-link" onClick={onBack}>
          ← {tCommon('back')}
        </span>
      )}
    </div>
  );
}
