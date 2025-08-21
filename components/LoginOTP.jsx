// components/LoginOTP.jsx
'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import '@/styles/LoginOTP.css';

export default function LoginOTP({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'done'
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep('otp');
      setMessage('📩 Te enviamos un código a tu correo.');
    } catch (err) {
      console.error(err);
      setMessage('⚠️ No pudimos enviar el código. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (error) throw error;
      setStep('done');
      setMessage('✅ Sesión iniciada correctamente.');
      onSuccess?.(); // 🚀 Avisamos al padre
    } catch (err) {
      console.error(err);
      setMessage('⚠️ El código no es válido o expiró.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-card">
      {step === 'email' && (
        <form onSubmit={handleSendCode} className="otp-form">
          <h2>Iniciar sesión</h2>
          <p className="muted">Ingresá tu correo y te enviaremos un código.</p>
          <input
            type="email"
            className="otp-input"
            placeholder="tunombre@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" className="otp-button" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerify} className="otp-form">
          <h2>Ingresar código</h2>
          <p className="muted">Revisá tu correo e ingresá el código recibido.</p>
          <input
            type="text"
            className="otp-input"
            placeholder="123456"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            disabled={loading}
          />
          <button type="submit" className="otp-button" disabled={loading}>
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="otp-success">
          <h2>¡Bienvenido!</h2>
          <p className="muted">Ya podés cerrar esta ventana.</p>
        </div>
      )}

      {message && <p className="otp-message">{message}</p>}
    </div>
  );
}
