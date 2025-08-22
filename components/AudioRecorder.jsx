'use client';

import React, { useEffect, useRef, useState } from 'react';
import '@/styles/AudioRecorder.css';

/**
 * 🔐 Planes:
 *  - free:  permite 1 (un) audio
 *  - premium: ilimitado
 *
 * En este componente aplicamos un guardado liviano en cliente (localStorage)
 * para bloquear múltiples audios en plan free. Más adelante, haremos la
 * verificación definitiva del lado servidor en /api/upload-url (PASO 4).
 */

const PLAN = 'free'; // 'free' | 'premium'
const FREE_AUDIO_FLAG = 'respirapp_free_audio_uploaded_v1';

// ⚠️ Mientras no tomemos el user desde auth, usa temporalmente un UUID real:
const HARD_USER_ID = 'REEMPLAZA_CON_TU_UUID_DE_SUPABASE';

/** Elige el mejor MIME soportado por MediaRecorder en este navegador */
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
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch (_) {}
  }
  return null;
}

export default function AudioRecorder({ hideTitle = false, autoStart = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    if (autoStart) startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  /** Subir blob usando signed URL desde /api/upload-url */
  async function uploadToSupabase(blob) {
    try {
      setStatus('Preparando subida…');

      // ⚠️ Por ahora pasamos userId desde el cliente para mantener simple la prueba.
      // Más adelante lo obtendremos del server (auth-helpers).
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: '417fe0ff-dca3-458c-adfe-39495af8cdeb', // 👈 Reemplaza con el UUID real del usuario autenticado
          kind: 'audio',
          contentType: blob.type || 'audio/webm',
          duration: null,
          size: blob.size ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'No se pudo obtener la signed URL');
      }

      const { signedUrl, path } = json;
      setStatus('Subiendo audio…');

      const put = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
        body: blob,
      });
      if (!put.ok) throw new Error('Error subiendo a Supabase');

      setStatus('✅ Subida exitosa');
      return path;
    } catch (err) {
      console.error(err);
      setError(err.message || String(err));
      setStatus('');
      return null;
    }
  }

  async function startRecording() {
    setError('');

    // Regla de plan free (cliente): solo 1 audio
    if (PLAN === 'free' && typeof window !== 'undefined') {
      const already = localStorage.getItem(FREE_AUDIO_FLAG);
      if (already === '1') {
        setError('Plan Free: ya guardaste tu único audio. Para más, pasa a Premium.');
        return;
      }
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

        // (1) Guardado local — si querés, aquí podrías usar IndexedDB (audioDB.js).
        // Por simplicidad, lo omitimos en este paso.
        // TODO: integrar audioDB.js si necesitas persistencia offline.

        // (2) Subida a Supabase
        if (navigator.onLine) {
          const path = await uploadToSupabase(blob);
          if (path && PLAN === 'free' && typeof window !== 'undefined') {
            // Marcamos que el usuario free ya subió su único audio
            localStorage.setItem(FREE_AUDIO_FLAG, '1');
          }
        } else {
          setError('Estás sin conexión. Vuelve a intentar cuando tengas internet.');
          setStatus('');
        }

        // Detener tracks del stream
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
      };

      mr.start();
    } catch (err) {
      console.error(err);
      setError('No se pudo iniciar la grabación. Revisa permisos del micrófono.');
    }
  }

  function stopRecording() {
    try {
      mediaRef.current?.stop();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="audio-recorder">
      {!hideTitle && <h3>Mensaje personalizado</h3>}

      {status && <p style={{ marginBottom: 8 }}>{status}</p>}
      {error && <p style={{ color: 'crimson', marginBottom: 8 }}>{error}</p>}

      {!isRecording ? (
        <button className="audio-button" onClick={startRecording}>
          🎤 Grabar mensaje
        </button>
      ) : (
        <button className="audio-button" onClick={stopRecording}>
          ⏹️ Detener grabación
        </button>
      )}

      {PLAN === 'free' && (
        <small style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>
          Plan Free: 1 audio permitido. Pasa a Premium para guardar ilimitados.
        </small>
      )}
    </div>
  );
}
