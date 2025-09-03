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

export default function AudioRecorder({
  hideTitle = false,
  onAudioReady,      // callback: se llama tras subida exitosa
  locked = false,    // si true, bloquear grabación (servidor dice que ya hay audio) — aplica a Free
  isPremium = false, // 👈 nuevo: para UX de límite
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(locked);

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
        // Para Premium, no deberíamos estar disabled; pero por las dudas lo ignoramos
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
