'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const PlayerCtx = createContext(null);

export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(null); // { id, kind, url, title? }
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'playing' | 'paused' | 'error'
  const [errorMsg, setErrorMsg] = useState(null);
  const [videoOpen, setVideoOpen] = useState(false);

  const playByItem = useCallback(async ({ id, kind = 'audio', title }) => {
    try {
      setStatus('loading');
      setErrorMsg(null);
      // firmar URL
      const res = await fetch('/api/media/sign-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const txt = await res.text();
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson && txt ? JSON.parse(txt) : {};
      if (!res.ok) {
        const msg = (isJson ? (data?.error || JSON.stringify(data)) : (txt || 'SIGN_ERROR'));
        throw new Error(msg);
      }
      const url = data?.url;
      if (!url) throw new Error('URL_FIRMADA_VACIA');
      // seteamos track actual
      setCurrent({ id, kind, url, title });
      setStatus('playing');
      setVideoOpen(false); // para video, se abre explícitamente desde la barra
    } catch (e) {
      setErrorMsg(e?.message || 'PLAYER_ERROR');
      setStatus('error');
    }
  }, []);

  const pause = useCallback(() => setStatus((s) => (s === 'playing' ? 'paused' : s)), []);
  const resume = useCallback(() => setStatus((s) => (s === 'paused' ? 'playing' : s)), []);
  const stop = useCallback(() => {
    setStatus('idle');
    setCurrent(null);
    setVideoOpen(false);
    setErrorMsg(null);
  }, []);
  const openVideo = useCallback(() => setVideoOpen(true), []);
  const closeVideo = useCallback(() => setVideoOpen(false), []);

  const value = useMemo(
    () => ({
      current,
      status,
      errorMsg,
      videoOpen,
      playByItem,
      pause,
      resume,
      stop,
      openVideo,
      closeVideo,
    }),
    [current, status, errorMsg, videoOpen, playByItem, pause, resume, stop, openVideo, closeVideo]
  );

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}
