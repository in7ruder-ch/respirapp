'use client';

import React, { useEffect, useRef, useState } from 'react';
import '@/styles/AudioRecorder.css';

const FREE_AUDIO_FLAG = 'respirapp_free_audio_uploaded_v1';
// ⚠️ Hasta integrar la sesión desde el servidor, usa tu UUID real aquí:
const HARD_USER_ID = '417fe0ff-dca3-458c-adfe-39495af8cdeb';

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
    try { if (MediaRecorder.isTypeSupported(c)) return c; } catch { }
  }
  return null;
}

export default function AudioRecorder({
  hideTitle = false,
  autoStart = false, // ignorado en Paso 1
  onAudioReady,      // callback opcional
  locked = false,    // NUEVO: si true, bloquear grabación (servidor dice que ya hay audio)
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [limitReached, setLimitReached] = useState(false);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Inicializa límite local; si viene locked=true desde el padre, manda ese estado.
  useEffect(() => {
    let local = false;
    try { local = localStorage.getItem(FREE_AUDIO_FLAG) === '1'; } catch { }
    setLimitReached(locked || local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si locked cambia en caliente (p.ej., después de refrescar status), actualizar
  useEffect(() => {
    setLimitReached((prev) => locked ? true : prev);
  }, [locked]);

  async function uploadToSupabase(blob) {
    setError('');
    setStatus('Preparando subida…');

    const res = await fetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'audio',
        contentType: blob.type || 'audio/webm',
        duration: null,
        size: blob.size ?? null,
      }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setLimitReached(true);
        setError(j?.error || 'Alcanzaste tu límite de plan.');
        setStatus('');
        return false;
      }
      throw new Error(j?.error || 'No se pudo obtener la URL firmada');
    }

    const { signedUrl } = await res.json();
    setStatus('Subiendo audio…');

    const put = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    });

    if (!put.ok) throw new Error('Error subiendo a Supabase');

    try { localStorage.setItem(FREE_AUDIO_FLAG, '1'); } catch { }
    setLimitReached(true);
    setStatus('✅ Subida exitosa');
    return true;
  }


  async function startRecording() {
    setError('');
    if (limitReached) {
      setError('Plan Free: ya guardaste tu único audio.');
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
              try { onAudioReady && onAudioReady(blob); } catch { }
            }
          } catch (err) {
            setError(err.message || String(err));
            setStatus('');
          }
        }

        try { stream.getTracks().forEach((t) => t.stop()); } catch { }
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
          disabled={limitReached}
          aria-disabled={limitReached}
        >
          🎤 Grabar mensaje
        </button>
      ) : (
        <button className="audio-button" onClick={stopRecording}>
          ⏹️ Detener grabación
        </button>
      )}

      <small style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>
        Plan Free: 1 audio permitido. Para ilimitados, pasá a Premium.
      </small>
    </div>
  );
}
