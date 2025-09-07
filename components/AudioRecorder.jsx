'use client';

import React, { useEffect, useRef, useState } from 'react';
import '@/styles/AudioRecorder.css';
import { apiFetch } from '@lib/apiFetch';
import { useTranslations } from 'next-intl';

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

// ISO local "YYYY-MM-DD HH:mm:ss"
function isoLocalNow() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

export default function AudioRecorder({
  hideTitle = false,
  onAudioReady,      // callback: se llama tras subida exitosa
  locked = false,    // si true, bloquear grabación (servidor dice que ya hay audio) — aplica a Free
  isPremium = false, // 👈 para UX de límite
}) {
  const t = useTranslations('recorder');
  const tLib = useTranslations('library');

  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(locked);

  // Nombre visible por defecto (localizado)
  const [title, setTitle] = useState(() => `${tLib('kind.audio')} ${isoLocalNow()}`);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    setDisabled(locked);
  }, [locked]);

  async function uploadToSupabase(blob) {
    setError('');
    setStatus(t('preparing'));

    let signedUrl;
    try {
      const res = await apiFetch('/api/upload-url', {
        method: 'POST',
        body: {
          kind: 'audio',
          contentType: blob.type || 'audio/webm',
          duration: null,
          size: blob.size ?? null,
          title: (title || '').trim(),
        },
      });
      signedUrl = res?.signedUrl;
      if (!signedUrl) throw new Error(t('signUrlError'));
    } catch (e) {
      if (e.status === 401) {
        setError(t('needLogin'));
        setStatus('');
        return false;
      }
      if (e.status === 403) {
        setError(e.message || t('planLimit'));
        if (!isPremium) setDisabled(true);
        setStatus('');
        return false;
      }
      setError(e.message || t('signUrlError'));
      setStatus('');
      return false;
    }

    setStatus(t('uploading'));

    const put = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
      body: blob,
    });

    if (!put.ok) throw new Error(t('supabaseError'));

    // ✅ Bloqueamos solo a Free; Premium puede seguir grabando otras veces
    setDisabled(!isPremium);
    setStatus(t('success'));
    return true;
  }

  async function startRecording() {
    setError('');
    if (disabled) {
      if (!isPremium) {
        setError(t('freeAlreadySaved'));
      } else {
        setDisabled(false);
      }
      return;
    }

    const mimeType = pickSupportedMime();
    if (!mimeType) {
      setError(t('noSupport'));
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
        setStatus(t('record')); // usar la key como estado corto "Grabando…"/"Record"
      };

      mr.onstop = async () => {
        setIsRecording(false);
        setStatus(t('processing'));

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        if (!navigator.onLine) {
          setError(t('offline'));
          setStatus('');
        } else {
          try {
            const ok = await uploadToSupabase(blob);
            if (ok) {
              try { onAudioReady && onAudioReady(blob); } catch {}
              // Sugerir un nombre nuevo para la próxima grabación
              setTitle(`${tLib('kind.audio')} ${isoLocalNow()}`);
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
      setError(t('permissionError'));
    }
  }

  function stopRecording() {
    try { mediaRef.current?.stop(); } catch (err) { console.error(err); }
  }

  return (
    <div className="audio-recorder">
      {!hideTitle && <h3>{t('customMessage')}</h3>}

      {/* Campo para elegir nombre visible */}
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span style={{ display: 'block', marginBottom: 4 }}>{t('name')}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('namePlaceholder')}
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
          🎤 {t('record')}
        </button>
      ) : (
        <button className="audio-button" onClick={stopRecording}>
          ⏹️ {t('stop')}
        </button>
      )}

      {/* Nota de límite SOLO para Free */}
      {!isPremium && (
        <small style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>
          {t('freeNote')}
        </small>
      )}
    </div>
  );
}
