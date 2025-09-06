'use client';
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import { usePlayer } from '@/components/player/PlayerProvider';

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
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const { playByItem } = usePlayer();

  // === Renombrado inline (estado global simple) ===
  const [editingId, setEditingId] = useState(null);
  const [editingVal, setEditingVal] = useState('');
  const [savingId, setSavingId] = useState(null);

  // Plan (para habilitar ⭐ solo en premium)
  const {
    data: planData,
    error: planError,
    isLoading: planLoading,
  } = useSWR('/api/me/plan', fetcher, { revalidateOnFocus: true, dedupingInterval: 1500 });

  // Resolver tier robusto: string | {tier} | {plan}
  const tierRaw = typeof planData === 'string' ? planData : (planData?.tier || planData?.plan || 'free');
  const isPremium = tierRaw === 'premium';

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
    // Asegurar title legible si viniera vacío (el API ya hace fallback, pero por las dudas)
    const withTitle = arr.map((it) => {
      if (it?.title && String(it.title).trim()) return it;
      const created = it?.created_at ? new Date(it.created_at) : null;
      const when = created ? created.toLocaleString('es-AR', { hour12: false }) : '';
      const kindNice = it?.kind === 'audio' ? 'Audio' : it?.kind === 'video' ? 'Video' : 'Media';
      return { ...it, title: `${kindNice}${when ? ' ' + when : ''}` };
    });
    return withTitle.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [listData]);

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

  async function fav(id) {
    if (!isPremium) return alert('Favoritos es una función Premium.');
    setBusyId(id);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/media/favorite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id }),
          });
          const { data, txt, isJson } = await safeParseResponse(res);
          if (res.status === 403) throw new Error('ONLY_PREMIUM');
          if (!res.ok) {
            const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'FAV_ERROR');
            throw new Error(msg);
          }
          const curItems = (current?.items || []).map((x) => ({ ...x, is_favorite: x.id === id }));
          return { items: curItems };
        },
        { revalidate: false }
      );
    } catch (e) {
      if (e?.message === 'ONLY_PREMIUM') {
        alert('Solo usuarios Premium pueden marcar favorito.');
      } else {
        alert('No se pudo marcar favorito.');
      }
      await mutate();
    } finally {
      await mutate();
      setBusyId(null);
    }
  }

  // === Renombrar ===
  function startEdit(it) {
    setEditingId(it.id);
    setEditingVal(it.title || '');
  }

  function cancelEdit(it) {
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
          // Llamada API
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
          // Optimistic update
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

  const activeNav = 'library';
  const showPlanGate = !planLoading && !planError && !isPremium;

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ padding: 16 }}>
          <h2>📚 Biblioteca</h2>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="primary" onClick={() => router.push('/message')}>
              🎙️ Grabar
            </button>
            {/* {showPlanGate && (
              <span className="muted" style={{ alignSelf: 'center' }}>
                ⭐ Favoritos es una función Premium
              </span>
            )} */}
          </div>

          {/* Lista */}
          <div style={{ marginTop: 16 }}>
            {listLoading ? (
              <p>Cargando…</p>
            ) : listError ? (
              <p className="text-red-600">Error al cargar la biblioteca.</p>
            ) : items.length === 0 ? (
              <p className="muted">No tenés mensajes aún. Grabá tu primer mensaje con el botón de arriba.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((it) => {
                  const isEditing = editingId === it.id;
                  const isRowBusy = busyId === it.id || savingId === it.id;
                  const title = isEditing ? editingVal : (it.title || '');

                  return (
                    <li
                      key={it.id}
                      className="library-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 8,
                        padding: '10px 0',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      <div>
                        {/* Título editable */}
                        {!isEditing ? (
                          <>
                            <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                              {title}
                              {it.is_favorite && <span style={{ color: '#0a0', marginLeft: 6 }}>★</span>}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                              {it.kind?.toUpperCase()} • {new Date(it.created_at).toLocaleString('es-AR', { hour12: false })}
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              value={title}
                              onChange={(e) => setEditingVal(e.target.value)}
                              maxLength={120}
                              placeholder="Nombre del mensaje"
                              style={{ flex: 1, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
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
                              onClick={() => cancelEdit(it)}
                              disabled={savingId === it.id}
                              title="Cancelar"
                            >
                              ✖
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Editar */}
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
                          onClick={() => fav(it.id)}
                          aria-label={isPremium ? 'Marcar favorito (uno máximo)' : 'Solo Premium'}
                          title={isPremium ? 'Marcar favorito (uno máximo)' : 'Solo Premium'}
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

      <BottomNav
        active={activeNav}
        onHome={() => router.push('/')}
        onLibrary={() => router.push('/library')}
        onPlaceholder1={() => router.push('/explore')}
        onPlaceholder2={() => router.push('/profile')}
      />
    </div>
  );
}
