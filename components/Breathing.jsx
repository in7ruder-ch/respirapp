// components/Breathing.jsx
'use client';

import React, { useEffect, useState } from 'react';
import '@/styles/Breathing.css'; // Asegúrate de tener un archivo CSS para estilos

export default function Breathing({ phases = [], onBack }) {
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
        <p className="instruction">No hay fases de respiración configuradas.</p>
        {onBack && (
          <button className="back-button" onClick={onBack}>
            ← Volver
          </button>
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
        }}
      >
        <span className="countdown">{timeLeft}</span>
      </div>

      <p className="instruction" key={label}>
        {label}
      </p>

      {onBack && (
        <button className="back-button" onClick={onBack}>
          ← Volver
        </button>
      )}
    </div>
  );
}
