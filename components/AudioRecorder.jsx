'use client';

import React, { useEffect, useRef, useState } from 'react';
import '@/styles/AudioRecorder.css';
import { apiFetch } from '@lib/apiFetch';

function pickSupportedMime() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/mpeg',
  ];
  if (
    typeof window === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    !MediaRecorder.isTypeSupported
  ) {
    return null;
  }
  for (const c of candidates) {
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch {}
  }
  return null;
}

// Default legible para el nombre visible
function defaultTitle(kind = 'audio') {
  const d = new Date();
  const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const prefix = kind === 'audio' ? 'Audio' : kind === 'video' ? 'Video' : 'Media';
  return `${prefix} ${isoLocal}`;
}

export default function AudioRecorder({
  hideTitle = false,
  onAudioReady,      // callback: se llama tras subida exitosa
  locked = false,    // si true, bloquear grabación (servidor dice que ya hay audio) — aplica a Free
  isPremium = false, // 👈 para UX de límite
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(locked);

  // 👇 Nuevo: nombre visible del mensaje
  const [title, setTitle] = useState(() => defaultTitle('audio'));

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    setDisabled(locked);
  }, [locked]);

  async function uploadToSupabase(blob) {
    setError('');
    setStatus('Preparando subida…');

    let signedUrl;
    try {
      const res = await apiFetch('/api/upload-url', {
        method: 'POST',
        body: {
          kind: 'audio',
          contentType: blob.type || 'audio/webm',
          duration: null,
          size: blob.size ?? null,
          title: (title || '').trim(), // 👈 enviar título elegido
        },
      });
      signedUrl = res?.signedUrl;
      if (!signedUrl) throw new Error('No se pudo obtener la URL firmada');
    } catch (e) {
      if (e.status === 401) {
        setError('Necesitás iniciar sesión para guardar tu mensaje.');
        setStatus('');
        return false;
      }
      if (e.status === 403) {
        // Límite (solo debería ocurrir en Free). Si llegara a pasar en Premium, mostramos el mensaje del backend.
        setError(e.message || 'Alcanzaste tu límite de plan.');
        if (!isPremium) setDisabled(true);
        setStatus('');
        return false;
      }
      setError(e.message || 'No se pudo obtener la URL firmada');
      setStatus('');
      return false;
    }

    setStatus('Subiendo audio…');

    const put = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
      body: blob,
    });

    if (!put.ok) throw new Error('Error subiendo a Supabase');

    // ✅ Bloqueamos solo a Free; Premium puede seguir grabando otras veces
    setDisabled(!isPremium);
    setStatus('✅ Subida exitosa');
    return true;
  }

  async function startRecording() {
    setError('');
    if (disabled) {
      if (!isPremium) {
        setError('Plan Free: ya guardaste tu único audio.');
      } else {
        // Para Premium, no deberíamos estar disabled; por si acaso lo ignoramos
        setDisabled(false);
      }
      return;
    }

    const mimeType = pickSupportedMime();
    if (!mimeType) {
      setError('Tu navegador no soporta grabación de audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstart = () => {
        setIsRecording(true);
        setStatus('Grabando…');
      };

      mr.onstop = async () => {
        setIsRecording(false);
        setStatus('Procesando…');

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (!navigator.onLine) {
          setError('Estás sin conexión. Intenta nuevamente con internet.');
          setStatus('');
        } else {
          try {
            const ok = await uploadToSupabase(blob);
            if (ok) {
              try { onAudioReady && onAudioReady(blob); } catch {}
              // Re-sugerir un nombre nuevo para la próxima grabación
              setTitle(defaultTitle('audio'));
            }
          } catch (err) {
            setError(err.message || String(err));
            setStatus('');
          }
        }

        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
      };

      mr.start();
    } catch (err) {
      console.error(err);
      setError('No se pudo iniciar la grabación. Revisa permisos del micrófono.');
    }
  }

  function stopRecording() {
    try { mediaRef.current?.stop(); } catch (err) { console.error(err); }
  }

  return (
    <div className="audio-recorder">
      {!hideTitle && <h3>Mensaje personalizado</h3>}

      {/* 👇 Campo para elegir nombre visible */}
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ display: 'block', marginBottom: 4 }}>Nombre</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Audio para mamá"
          maxLength={120}
          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
        />
      </label>

      {status && <p style={{ marginBottom: 8 }}>{status}</p>}
      {error && <p style={{ color: 'crimson', marginBottom: 8 }}>{error}</p>}

      {!isRecording ? (
        <button
          className="audio-button"
          onClick={startRecording}
          disabled={disabled}
          aria-disabled={disabled}
        >
          🎤 Grabar mensaje
        </button>
      ) : (
        <button className="audio-button" onClick={stopRecording}>
          ⏹️ Detener grabación
        </button>
      )}

      {/* Nota de límite SOLO para Free */}
      {!isPremium && (
        <small style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>
          Plan Free: 1 audio permitido. Para ilimitados, pasá a Premium.
        </small>
      )}
    </div>
  );
}
