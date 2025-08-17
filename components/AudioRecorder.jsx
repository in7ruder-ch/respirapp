'use client';

import React, { useEffect, useRef, useState } from 'react';
import '@/styles/AudioRecorder.css';

function pickSupportedMime() {
  const candidates = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/mpeg',
    'audio/webm;codecs=opus',
    'audio/webm',
  ];
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return null;
  }
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

export default function AudioRecorder({ onAudioReady, onSave, hideTitle = true, autoStart = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(false);

  const startRecording = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        alert('La API de micrófono no está disponible en este navegador.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = pickSupportedMime();
      const options = mimeType ? { mimeType } : undefined;

      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const type = mimeType || (chunksRef.current[0]?.type || 'audio/webm');
        const blob = new Blob(chunksRef.current, { type });
        // liberar mic
        stream.getTracks().forEach((t) => t.stop());
        if (typeof onAudioReady === 'function') onAudioReady(blob);
        else if (typeof onSave === 'function') onSave(blob);
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error al acceder al micrófono:', err);
      alert('No se pudo acceder al micrófono. Verificá los permisos del navegador.');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (autoStart && !startedRef.current && !isRecording) {
      startedRef.current = true;
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="audio-recorder">
      {!hideTitle && <h3>Mensaje personalizado</h3>}
      {!isRecording ? (
        <button className="audio-button" onClick={startRecording}>
          🎤 Grabar mensaje
        </button>
      ) : (
        <button className="audio-button" onClick={stopRecording}>
          ⏹️ Detener grabación
        </button>
      )}
    </div>
  );
}
