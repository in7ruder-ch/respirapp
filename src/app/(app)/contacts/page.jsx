'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';
import '@/styles/Contacts.css';

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

  async function addContact(e) {
    e?.preventDefault?.();
    if (freeAtLimit) return alert('Free: sólo podés guardar 1 contacto.');
    const name = (addName || '').trim();
    const phone = (addPhone || '').trim();
    if (!name || !phone) return alert('Completá al menos Nombre y Teléfono.');
    setAdding(true);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/contacts/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, phone }),
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
      setAddName(''); setAddPhone('');
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
  const [editing, setEditing] = useState({ name: '', phone: '' });
  const [savingId, setSavingId] = useState(null);

  function startEdit(it) {
    setEditingId(it.id);
    setEditing({ name: it.name || '', phone: it.phone || '' });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditing({ name: '', phone: '' });
  }

  async function saveEdit(it) {
    const name = (editing.name || '').trim();
    const phone = (editing.phone || '').trim();
    if (!name || !phone) return alert('Nombre y Teléfono son obligatorios.');
    setSavingId(it.id);
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/contacts/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ id: it.id, name, phone }),
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
      setEditing({ name: '', phone: '' });
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
    window.location.href = `tel:${encodeURIComponent(phone)}`;
  }

  const activeNav = 'profile';
  const showPlanGate = !planLoading && !planError && !isPremium;

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="contacts-panel">
          <h2>🚨 Contactos de emergencia</h2>

          {/* Alta */}
          <form onSubmit={addContact} className="contact-form">
            <div className="form-fields">
              <div>
                <label>Nombre*</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Ej: Mamá"
                  maxLength={120}
                  disabled={adding || freeAtLimit}
                />
              </div>
              <div>
                <label>Teléfono*</label>
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="+54 9 11 1234 5678"
                  maxLength={40}
                  disabled={adding || freeAtLimit}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={adding || freeAtLimit}>
                ➕ Agregar
              </button>
              {freeAtLimit && (
                <span className="muted">
                  Free: 1 contacto máximo. Para más, pasá a Premium.
                </span>
              )}
            </div>
          </form>

          {/* Lista */}
          <div className="contacts-list">
            {listLoading ? (
              <p>Cargando…</p>
            ) : listError ? (
              <p className="text-red-600">Error al cargar tus contactos.</p>
            ) : items.length === 0 ? (
              <p className="muted">No tenés contactos aún. Agregá tu primero arriba.</p>
            ) : (
              <ul>
                {items.map((it) => {
                  const isRowBusy = busyId === it.id || savingId === it.id;
                  const isEditing = editingId === it.id;

                  return (
                    <li key={it.id} className="contact-row">
                      <div className="contact-info">
                        {!isEditing ? (
                          <>
                            <div className="contact-name">
                              {it.name}
                              {it.is_favorite && <span className="favorite">★</span>}
                            </div>
                            <div className="contact-meta">
                              {it.phone}
                            </div>
                          </>
                        ) : (
                          <div className="edit-fields">
                            <input
                              value={editing.name}
                              onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                              placeholder="Nombre"
                              maxLength={120}
                              autoFocus
                            />
                            <input
                              value={editing.phone}
                              onChange={(e) => setEditing((s) => ({ ...s, phone: e.target.value }))}
                              placeholder="Teléfono"
                              maxLength={40}
                            />
                            <div className="edit-actions">
                              <button
                                className="secondary"
                                onClick={() => saveEdit(it)}
                                disabled={isRowBusy}
                              >
                                💾
                              </button>
                              <button
                                className="secondary"
                                onClick={cancelEdit}
                                disabled={isRowBusy}
                              >
                                ✖
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="contact-actions">
                        {!isEditing && (
                          <button
                            className="secondary"
                            disabled={isRowBusy}
                            onClick={() => call(it.phone)}
                          >
                            📞
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            className="secondary"
                            disabled={isRowBusy}
                            onClick={() => startEdit(it)}
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={isRowBusy}
                          onClick={() => del(it.id)}
                        >
                          🗑️
                        </button>
                        <button
                          className={`secondary ${!isPremium ? 'disabled' : ''}`}
                          disabled={!isPremium || isRowBusy}
                          onClick={() => fav(it.id)}
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
            <div className="muted">
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
