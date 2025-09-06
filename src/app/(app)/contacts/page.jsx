'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

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

export default function ContactsPage() {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);

  // Plan (para gating)
  const { data: planData, isLoading: planLoading, error: planError } = useSWR(
    '/api/me/plan',
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 1500 }
  );
  const tierRaw = typeof planData === 'string' ? planData : (planData?.tier || planData?.plan || 'free');
  const isPremium = tierRaw === 'premium';

  // Lista de contactos
  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
    mutate,
  } = useSWR('/api/contacts/list', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  });

  const items = useMemo(() => (listData?.items || []), [listData]);
  const contactCount = items.length;
  const freeAtLimit = !isPremium && contactCount >= 1;

  // === Alta ===
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');

  async function addContact(e) {
    e?.preventDefault?.();
    if (freeAtLimit) return alert('Free: sólo podés guardar 1 contacto.');
    const name = (addName || '').trim();
    const phone = (addPhone || '').trim();
    const email = (addEmail || '').trim();
    if (!name || !phone) return alert('Completá al menos Nombre y Teléfono.');
    setAdding(true);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/contacts/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, phone, email }),
          });
          const { data, txt, isJson } = await safeParseResponse(res);
          if (!res.ok) {
            const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'ADD_ERROR');
            throw new Error(msg);
          }
          const newItem = data?.item;
          const curItems = [newItem, ...(current?.items || [])];
          return { items: curItems, tier: current?.tier ?? listData?.tier };
        },
        { revalidate: false }
      );
      setAddName(''); setAddPhone(''); setAddEmail('');
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('LIMIT_REACHED_FREE')) {
        alert('Plan Free: ya tenés 1 contacto guardado.');
      } else {
        alert('No se pudo agregar el contacto.');
      }
      await mutate();
    } finally {
      await mutate();
      setAdding(false);
    }
  }

  // === Edición inline ===
  const [editingId, setEditingId] = useState(null);
  const [editing, setEditing] = useState({ name: '', phone: '', email: '' });
  const [savingId, setSavingId] = useState(null);

  function startEdit(it) {
    setEditingId(it.id);
    setEditing({ name: it.name || '', phone: it.phone || '', email: it.email || '' });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditing({ name: '', phone: '', email: '' });
  }

  async function saveEdit(it) {
    const name = (editing.name || '').trim();
    const phone = (editing.phone || '').trim();
    const email = (editing.email || '').trim();
    if (!name || !phone) return alert('Nombre y Teléfono son obligatorios.');
    setSavingId(it.id);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/contacts/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: it.id, name, phone, email }),
          });
          const { data, txt, isJson } = await safeParseResponse(res);
          if (!res.ok) {
            const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'UPDATE_ERROR');
            throw new Error(msg);
          }
          const updated = data?.item;
          const curItems = (current?.items || []).map((x) => (x.id === it.id ? updated : x));
          return { items: curItems, tier: current?.tier ?? listData?.tier };
        },
        { revalidate: false }
      );
      setEditingId(null);
      setEditing({ name: '', phone: '', email: '' });
    } catch {
      alert('No se pudo actualizar el contacto.');
      await mutate();
    } finally {
      await mutate();
      setSavingId(null);
    }
  }

  // === Borrar ===
  async function del(id) {
    if (!confirm('¿Borrar este contacto?')) return;
    setBusyId(id);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/contacts/delete', {
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
          return { items: curItems, tier: current?.tier ?? listData?.tier };
        },
        { revalidate: false }
      );
    } catch {
      alert('No se pudo borrar el contacto.');
      await mutate();
    } finally {
      await mutate();
      setBusyId(null);
    }
  }

  // === Favorito (solo Premium) ===
  async function fav(id) {
    if (!isPremium) return alert('Favoritos es una función Premium.');
    setBusyId(id);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/contacts/favorite', {
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
          const updated = data?.item;
          const curItems = (current?.items || []).map((x) => ({
            ...x,
            is_favorite: x.id === updated.id,
          }));
          return { items: curItems, tier: current?.tier ?? listData?.tier };
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

  // === Llamar ===
  function call(phone) {
    if (!phone) return alert('Este contacto no tiene teléfono.');
    // navegación tel: (movil); en desktop puede abrir app por defecto
    try {
      window.location.href = `tel:${encodeURIComponent(phone)}`;
    } catch {
      // no-op
    }
  }

  const activeNav = 'profile'; // o 'library' según tu BottomNav
  const showPlanGate = !planLoading && !planError && !isPremium;

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ padding: 16 }}>
          <h2>🚨 Contactos de emergencia</h2>

          {/* Alta */}
          <form onSubmit={addContact} style={{ marginTop: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>Nombre*</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Ej: Mamá"
                  maxLength={120}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
                  disabled={adding || freeAtLimit}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>Teléfono*</label>
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="+54 9 11 1234 5678"
                  maxLength={40}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
                  disabled={adding || freeAtLimit}
                />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>Email (opcional)</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="ejemplo@mail.com"
                maxLength={120}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
                disabled={adding || freeAtLimit}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="primary" type="submit" disabled={adding || freeAtLimit}>
                ➕ Agregar
              </button>
              {freeAtLimit && (
                <span className="muted" style={{ alignSelf: 'center' }}>
                  Free: 1 contacto máximo. Para más, pasá a Premium.
                </span>
              )}
            </div>
          </form>

          {/* Lista */}
          <div style={{ marginTop: 16 }}>
            {listLoading ? (
              <p>Cargando…</p>
            ) : listError ? (
              <p className="text-red-600">Error al cargar tus contactos.</p>
            ) : items.length === 0 ? (
              <p className="muted">No tenés contactos aún. Agregá tu primero arriba.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {items.map((it) => {
                  const isRowBusy = busyId === it.id || savingId === it.id;
                  const isEditing = editingId === it.id;

                  return (
                    <li
                      key={it.id}
                      className="contact-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 8,
                        padding: '10px 0',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      <div>
                        {!isEditing ? (
                          <>
                            <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                              {it.name}
                              {it.is_favorite && <span style={{ color: '#0a0', marginLeft: 6 }}>★</span>}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                              {it.phone}
                              {it.email ? ` • ${it.email}` : ''}
                              <span style={{ opacity: 0.6 }}>
                                {' '}
                                • {new Date(it.created_at).toLocaleString('es-AR', { hour12: false })}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <input
                              value={editing.name}
                              onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                              placeholder="Nombre"
                              maxLength={120}
                              style={{ padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
                              autoFocus
                            />
                            <input
                              value={editing.phone}
                              onChange={(e) => setEditing((s) => ({ ...s, phone: e.target.value }))}
                              placeholder="Teléfono"
                              maxLength={40}
                              style={{ padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
                            />
                            <input
                              value={editing.email}
                              onChange={(e) => setEditing((s) => ({ ...s, email: e.target.value }))}
                              placeholder="Email (opcional)"
                              maxLength={120}
                              style={{ gridColumn: '1 / span 2', padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="secondary"
                                onClick={() => saveEdit(it)}
                                disabled={isRowBusy}
                                title="Guardar"
                              >
                                💾
                              </button>
                              <button
                                className="secondary"
                                onClick={cancelEdit}
                                disabled={isRowBusy}
                                title="Cancelar"
                              >
                                ✖
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {!isEditing && (
                          <button
                            className="secondary"
                            disabled={isRowBusy}
                            onClick={() => call(it.phone)}
                            aria-label="Llamar"
                            title="Llamar"
                          >
                            📞
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            className="secondary"
                            disabled={isRowBusy}
                            onClick={() => startEdit(it)}
                            aria-label="Editar"
                            title="Editar"
                          >
                            ✏️
                          </button>
                        )}
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

          {showPlanGate && (
            <div className="muted" style={{ marginTop: 8 }}>
              ⭐ Favoritos y múltiples contactos son funciones Premium.
            </div>
          )}
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
