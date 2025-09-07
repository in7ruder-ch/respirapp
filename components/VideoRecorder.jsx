'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@lib/apiFetch';
import '@/styles/VideoRecorder.css';
import { useTranslations } from 'next-intl';

function isoLocalNow() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

export default function VideoRecorder({ hideTitle = false, onVideoReady }) {
  const t = useTranslations('vrecorder');
  const tLib = useTranslations('library');

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [permissionError, setPermissionError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [banner, setBanner] = useState('');

  // Nombre visible (prefijo localizado)
  const [title, setTitle] = useState(() => `${tLib('kind.video')} ${isoLocalNow()}`);

  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setPermissionError(t('permissionError'));
      }
    })();

    return () => { stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAll() {
    try { clearInterval(timerRef.current); } catch {}
    try { mediaRecorderRef.current?.stop?.(); } catch {}
    try { streamRef.current?.getTracks?.().forEach(t => t.stop()); } catch {}
    mediaRecorderRef.current = null;
    streamRef.current = null;
  }

  function startRecording() {
    if (!streamRef.current) return;
    try {
      chunksRef.current = [];
      const options = pickMediaRecorderOptions();
      const mr = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleStop;

      mr.start();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setPermissionError(t('startError'));
    }
  }

  function stopRecording() {
    try { mediaRecorderRef.current?.stop?.(); } catch {}
  }

  function pickMediaRecorderOptions() {
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported?.('video/webm;codecs=vp9')) return { mimeType: 'video/webm;codecs=vp9' };
      if (MediaRecorder.isTypeSupported?.('video/webm;codecs=vp8')) return { mimeType: 'video/webm;codecs=vp8' };
      if (MediaRecorder.isTypeSupported?.('video/webm')) return { mimeType: 'video/webm' };
    }
    return {};
  }

  async function handleStop() {
    try { clearInterval(timerRef.current); } catch {}
    setIsRecording(false);

    const blob = new Blob(chunksRef.current, { type: inferBlobType(chunksRef.current) });
    chunksRef.current = [];

    setIsUploading(true);
    setBanner('');
    try {
      const contentType = blob.type || 'video/webm';
      const { signedUrl } = await apiFetch('/api/upload-url', {
        method: 'POST',
        body: { kind: 'video', contentType, title: (title || '').trim() },
      });

      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: blob,
      });
      if (!putRes.ok) throw new Error('UPLOAD_ERROR');

      setBanner(t('saved'));
      setTimeout(() => setBanner(''), 1800);
      onVideoReady?.({ ok: true });

      // Sugerir un nombre nuevo para la próxima grabación
      setTitle(`${tLib('kind.video')} ${isoLocalNow()}`);
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('LIMIT_REACHED')) {
        setBanner(t('limitFree'));
      } else {
        setBanner(t('uploadError'));
      }
    } finally {
      setIsUploading(false);
    }
  }

  function inferBlobType(chunks) {
    const withType = chunks?.find?.((c) => c?.type && c.type !== 'application/octet-stream');
    return withType?.type || 'video/webm';
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="vr-wrap">
      {!hideTitle && <h3 className="vr-title">{t('recordVideo')}</h3>}

      <label className="vr-field">
        <span className="vr-label">{t('name')}</span>
        <input
          className="vr-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('namePlaceholder')}
          maxLength={120}
        />
      </label>

      {permissionError && <div className="vr-alert error">{permissionError}</div>}
      {banner && <div className="vr-alert">{banner}</div>}

      <div className="vr-panel">
        <video
          ref={videoRef}
          className="vr-preview"
          playsInline
          muted
          autoPlay
        />

        <div className="vr-controls">
          {!isRecording ? (
            <button
              className="vr-btn primary"
              onClick={startRecording}
              disabled={!!permissionError || isUploading}
            >
              ⏺️ {t('record')}
            </button>
          ) : (
            <button
              className="vr-btn danger"
              onClick={stopRecording}
              disabled={isUploading}
            >
              ⏹️ {t('stop')}
            </button>
          )}

          <span className="vr-timer">
            {isRecording ? `${mm}:${ss}` : '00:00'}
          </span>
        </div>
      </div>
    </div>
  );
}
