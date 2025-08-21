// src/components/AuthMagicLink.jsx
'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient'; // Asegúrate de que la ruta sea correcta
import '@/styles/Auth.css';

function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL; // opcional si la querés usar
  const raw = envUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw && raw.startsWith('localhost')) return `http://${raw}`;
  return 'http://localhost:3000';
}

export default function AuthMagicLink({ onSent, onError }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email) return;

    try {
      setSending(true);
      setMessage('');

      // Con implicit flow, redirigimos al origen (/) y Supabase procesa la URL
      const redirectTo = `${getBaseUrl()}/`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      setSent(true);
      setMessage('✅ Te enviamos un enlace mágico a tu correo. Revisá tu email.');
      onSent?.(email);
    } catch (err) {
      console.error(err);
      setMessage('⚠️ No pudimos enviar el enlace. Probá nuevamente.');
      onError?.(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="auth-card" onSubmit={handleSend}>
      <h2>Iniciar sesión</h2>
      <p className="muted">Recibí un enlace mágico en tu email para entrar.</p>

      <label htmlFor="email" className="auth-label">Email</label>
      <input
        id="email"
        type="email"
        className="auth-input"
        placeholder="tunombre@correo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={sending || sent}
      />

      <button
        type="submit"
        className="auth-button"
        disabled={sending || sent}
      >
        {sending ? 'Enviando...' : sent ? 'Enlace enviado' : 'Enviar enlace'}
      </button>

      {message && <p className="auth-message">{message}</p>}
    </form>
  );
}
