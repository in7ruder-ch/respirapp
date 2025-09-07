'use client';
import { useState, useMemo } from 'react';
import useSWR from 'swr';

import '@/styles/App.css';
import '@/styles/BottomNav.css';
import '@/styles/Library.css';

import { usePlayer } from '@/components/player/PlayerProvider';
import AudioRecorder from '@/components/AudioRecorder';
import VideoRecorder from '@/components/VideoRecorder';

async function safeParseResponse(res) {
  const txt = await res.text();
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson && txt ? JSON.parse(txt) : (txt || null);
  return { data, txt, isJson };
}

const fetcher = async (u) => {
  const r = await fetch(u, { cache: 'no-store', credentials: 'include' });
  const { data, txt, isJson } = await safeParseResponse(r);
  if (!r.ok) {
    const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'HTTP_ERROR');
    throw new Error(msg);
  }
  return isJson ? data : { raw: data };
};

export default function LibraryPage() {
  const [busyId, setBusyId] = useState(null);
  const { playByItem } = usePlayer();

  // Renombrado
  const [editingId, setEditingId] = useState(null);
  const [editingVal, setEditingVal] = useState('');
  const [savingId, setSavingId] = useState(null);

  // Creación inline
  const [createMode, setCreateMode] = useState('none'); // 'none' | 'audio' | 'video'
  const [recorderKey, setRecorderKey] = useState(0);

  // Toast de confirmación
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Plan
  const {
    data: planData,
    error: planError,
    isLoading: planLoading,
  } = useSWR('/api/me/plan', fetcher, { revalidateOnFocus: true, dedupingInterval: 1500 });

  const tierRaw = typeof planData === 'string' ? planData : (planData?.tier || planData?.plan || 'free');
  const isPremium = tierRaw === 'premium';
  const isFree = !isPremium;

  // Lista de media
  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate,
  } = useSWR('/api/media/list', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 1500,
  });

  const items = useMemo(() => {
    const arr = listData?.items || [];
    const withTitle = arr.map((it) => {
      if (it?.title && String(it.title).trim()) return it;
      const created = it?.created_at ? new Date(it.created_at) : null;
      const when = created ? created.toLocaleString('es-AR', { hour12: false }) : '';
      const kindNice = it?.kind === 'audio' ? 'Audio' : it?.kind === 'video' ? 'Video' : 'Media';
      return { ...it, title: `${kindNice}${when ? ' ' + when : ''}` };
    });
    return withTitle.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [listData]);

  const count = items.length;

  async function play(id, kind) {
    setBusyId(id);
    try {
      await playByItem({ id, kind });
    } catch {
      alert('No se pudo reproducir el mensaje.');
    } finally {
      setBusyId(null);
    }
  }

  async function del(id) {
    if (!confirm('¿Borrar este mensaje? Esta acción es permanente.')) return;
    setBusyId(id);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/media/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id }),
          });
          const { data, txt, isJson } = await safeParseResponse(res);
          if (!res.ok) {
            const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'DELETE_ERROR');
            throw new Error(msg);
          }
          const curItems = (current?.items || []).filter((x) => x.id !== id);
          return { items: curItems };
        },
        { revalidate: false }
      );
    } catch {
      alert('No se pudo borrar el mensaje.');
      await mutate();
    } finally {
      await mutate();
      setBusyId(null);
    }
  }

  async function fav(it) {
    if (!isPremium) return alert('Favoritos es una función Premium.');
    setBusyId(it.id);
    const wasFav = !!it.is_favorite;

    try {
      await mutate(
        async (current) => {
          // Toggle
          const res = await fetch('/api/media/favorite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: it.id }),
          });
          const { data, txt, isJson } = await safeParseResponse(res);
          if (res.status === 403) throw new Error('ONLY_PREMIUM');
          if (!res.ok) {
            const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'FAV_ERROR');
            throw new Error(msg);
          }

          const curItems = (current?.items || []).map((x) => {
            if (wasFav) return { ...x, is_favorite: false };
            return { ...x, is_favorite: x.id === it.id };
          });
          return { items: curItems };
        },
        { revalidate: false }
      );
    } catch (e) {
      if (e?.message === 'ONLY_PREMIUM') {
        alert('Solo usuarios Premium pueden marcar favorito.');
      } else {
        alert('No se pudo actualizar favorito.');
      }
      await mutate();
    } finally {
      await mutate();
      setBusyId(null);
    }
  }

  // Renombrar
  function startEdit(it) {
    setEditingId(it.id);
    setEditingVal(it.title || '');
  }
  function cancelEdit() {
    setEditingId(null);
    setEditingVal('');
  }
  async function saveEdit(it) {
    const newTitle = (editingVal || '').trim();
    if (!newTitle) {
      alert('El nombre no puede estar vacío.');
      return;
    }
    if (newTitle === it.title) {
      setEditingId(null);
      return;
    }
    setSavingId(it.id);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/media/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: it.id, title: newTitle }),
          });
          const { data, txt, isJson } = await safeParseResponse(res);
          if (!res.ok) {
            const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'RENAME_ERROR');
            throw new Error(msg);
          }
          const curItems = (current?.items || []).map((x) =>
            x.id === it.id ? { ...x, title: newTitle } : x
          );
          return { items: curItems };
        },
        { revalidate: false }
      );
      setEditingId(null);
      setEditingVal('');
    } catch (e) {
      alert('No se pudo renombrar: ' + (e?.message || 'RENAME_ERROR'));
      await mutate();
    } finally {
      await mutate();
      setSavingId(null);
    }
  }

  // Tiles / límites
  const showCreateTiles = isPremium || (isFree && count === 0);
  const showFreeLimitPanel = isFree && count >= 1;

  // Recorder handlers
  function openAudio() { setCreateMode('audio'); setRecorderKey(k => k + 1); }
  function openVideo() { setCreateMode('video'); setRecorderKey(k => k + 1); }
  function closeRecorder() { setCreateMode('none'); }

  async function onAudioReady() {
    closeRecorder();
    await mutate();
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
  }
  async function onVideoReady() {
    closeRecorder();
    await mutate();
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
  }

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        {/* wrapper estable para lista y empty */}
        <div className="screen-wrap panel library-panel">
          <h2>📚 Biblioteca</h2>

          {showConfirmation && (
            <div className="confirmation-banner confirmation-fadeout">✅ Mensaje guardado</div>
          )}

          {/* Tiles de creación o Recorder inline */}
          {showCreateTiles && (
            <>
              {createMode === 'none' ? (
                <div className="launcher-grid library-tiles">
                  <button
                    className="launcher-item blue"
                    onClick={openAudio}
                    aria-label="Grabar audio"
                    title="Grabar audio"
                  >
                    <div className="icon-bg bg-message" aria-hidden="true" />
                    <div className="label">Grabar audio</div>
                  </button>

                  <button
                    className="launcher-item red"
                    onClick={openVideo}
                    aria-label="Grabar video"
                    title="Grabar video"
                  >
                    <div className="icon-bg bg-message" aria-hidden="true" />
                    <div className="label">Grabar video</div>
                  </button>
                </div>
              ) : (
                <div className="recorder-panel">
                  <div className="recorder-header">
                    <button className="secondary" onClick={closeRecorder} aria-label="Volver">← Volver</button>
                    <div className="recorder-title">
                      {createMode === 'audio' ? 'Grabar audio' : 'Grabar video'}
                    </div>
                  </div>

                  {createMode === 'audio' && (
                    <AudioRecorder
                      key={recorderKey}
                      onAudioReady={onAudioReady}
                      hideTitle
                      isPremium={isPremium}
                      locked={isFree && count >= 1}
                    />
                  )}

                  {createMode === 'video' && (
                    <VideoRecorder
                      key={recorderKey}
                      onVideoReady={onVideoReady}
                      hideTitle
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* Aviso de límite Free */}
          {showFreeLimitPanel && (
            <div className="panel library-free-limit">
              <p className="m0">Ya tenés un mensaje guardado.</p>
              <p className="muted mt6">
                En plan Free podés tener 1 (audio <em>o</em> video). Para grabar uno nuevo, primero borrá el actual.
              </p>
            </div>
          )}

          {/* Lista */}
          <div className="library-list">
            {listLoading ? (
              <p>Cargando…</p>
            ) : listError ? (
              <p className="text-red-600">Error al cargar la biblioteca.</p>
            ) : items.length === 0 ? (
              <p className="muted">No tenés mensajes aún.</p>
            ) : (
              <ul className="library-ul">
                {items.map((it) => {
                  const isEditing = editingId === it.id;
                  const isRowBusy = busyId === it.id || savingId === it.id;
                  const title = isEditing ? editingVal : (it.title || '');

                  return (
                    <li key={it.id} className="library-row">
                      <div>
                        {!isEditing ? (
                          <>
                            <div className="library-title">
                              {title}
                              {it.is_favorite && <span className="favorite">★</span>}
                            </div>
                            <div className="library-meta muted">
                              {it.kind?.toUpperCase()} • {new Date(it.created_at).toLocaleString('es-AR', { hour12: false })}
                            </div>
                          </>
                        ) : (
                          <div className="edit-line">
                            <input
                              className="edit-input"
                              value={title}
                              onChange={(e) => setEditingVal(e.target.value)}
                              maxLength={120}
                              placeholder="Nombre del mensaje"
                              autoFocus
                            />
                            <button
                              className="secondary"
                              onClick={() => saveEdit(it)}
                              disabled={savingId === it.id}
                              title="Guardar"
                            >
                              💾
                            </button>
                            <button
                              className="secondary"
                              onClick={() => cancelEdit()}
                              disabled={savingId === it.id}
                              title="Cancelar"
                            >
                              ✖
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="action-bar">
                        {!isEditing && (
                          <button
                            className="secondary"
                            disabled={isRowBusy}
                            onClick={() => startEdit(it)}
                            aria-label="Renombrar"
                            title="Renombrar"
                          >
                            ✏️
                          </button>
                        )}

                        <button
                          className="secondary"
                          disabled={isRowBusy}
                          onClick={() => play(it.id, it.kind)}
                          aria-label="Reproducir"
                          title="Reproducir"
                        >
                          ▶
                        </button>
                        <button
                          className="secondary"
                          disabled={isRowBusy}
                          onClick={() => del(it.id)}
                          aria-label="Borrar"
                          title="Borrar"
                        >
                          🗑️
                        </button>
                        <button
                          className={`secondary ${!isPremium ? 'disabled' : ''}`}
                          disabled={!isPremium || isRowBusy}
                          onClick={() => fav(it)}
                          aria-label={isPremium ? (it.is_favorite ? 'Quitar de favorito' : 'Marcar favorito') : 'Solo Premium'}
                          title={isPremium ? (it.is_favorite ? 'Quitar de favorito' : 'Marcar favorito (uno máximo)') : 'Solo Premium'}
                        >
                          ⭐
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
