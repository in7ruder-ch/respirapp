'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

import '@/styles/App.css';
import '@/styles/BottomNav.css';
import '@/styles/Contacts.css';

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
  const t = useTranslations('contacts');

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
    if (freeAtLimit) return alert(t('freeLimit1'));
    const name = (addName || '').trim();
    const phone = (addPhone || '').trim();
    if (!name || !phone) return alert(t('requiredNamePhone'));
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
        alert(t('freeAlreadyOne'));
      } else {
        alert(t('addError'));
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
    if (!name || !phone) return alert(t('requiredNamePhone'));
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
      alert(t('updateError'));
      await mutate();
    } finally {
      await mutate();
      setSavingId(null);
    }
  }

  // === Borrar ===
  async function del(id) {
    if (!confirm(t('confirmDelete'))) return;
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
      alert(t('deleteError'));
      await mutate();
    } finally {
      await mutate();
      setBusyId(null);
    }
  }

  // === Favorito (solo Premium) ===
  async function favContact(it) {
    if (!isPremium) return alert(t('onlyPremium'));
    setBusyId(it.id);
    const wasFav = !!it.is_favorite;
    try {
      await mutate(
        async (current) => {
          const res = await fetch('/api/contacts/favorite', {
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
          const cur = (current?.items || []).map((x) => {
            if (wasFav) return { ...x, is_favorite: false };
            return { ...x, is_favorite: x.id === it.id };
          });
          return { items: cur };
        },
        { revalidate: false }
      );
    } catch (e) {
      if (e?.message === 'ONLY_PREMIUM') {
        alert(t('onlyPremium'));
      } else {
        alert(t('favoriteError'));
      }
      await mutate();
    } finally {
      await mutate();
      setBusyId(null);
    }
  }

  // === Llamar ===
  function call(phone) {
    if (!phone) return alert(t('missingPhone'));
    window.location.href = `tel:${encodeURIComponent(phone)}`;
  }

  const showPlanGate = !planLoading && !planError && !isPremium;

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="screen-wrap contacts-panel">
          <h2>🚨 {t('title')}</h2>

          {/* Alta */}
          <form onSubmit={addContact} className="contact-form">
            <div className="form-fields">
              <div>
                <label>{t('nameLabel')}*</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  maxLength={120}
                  disabled={adding || freeAtLimit}
                />
              </div>
              <div>
                <label>{t('phoneLabel')}*</label>
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  maxLength={40}
                  disabled={adding || freeAtLimit}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={adding || freeAtLimit}>
                ➕ {t('add')}
              </button>
              {freeAtLimit && (
                <span className="muted">{t('freeNote')}</span>
              )}
            </div>
          </form>

          {/* Lista */}
          <div className="contacts-list">
            {listLoading ? (
              <p>{t('loading')}</p>
            ) : listError ? (
              <p className="text-red-600">{t('loadError')}</p>
            ) : items.length === 0 ? (
              <p className="muted">{t('empty')}</p>
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
                            <div className="contact-meta">{it.phone}</div>
                          </>
                        ) : (
                          <div className="edit-fields">
                            <input
                              value={editing.name}
                              onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                              placeholder={t('namePlaceholder')}
                              maxLength={120}
                              autoFocus
                            />
                            <input
                              value={editing.phone}
                              onChange={(e) => setEditing((s) => ({ ...s, phone: e.target.value }))}
                              placeholder={t('phonePlaceholder')}
                              maxLength={40}
                            />
                            <div className="edit-actions">
                              <button
                                className="secondary"
                                onClick={() => saveEdit(it)}
                                disabled={isRowBusy}
                                title={t('save')}
                                aria-label={t('save')}
                              >
                                💾
                              </button>
                              <button
                                className="secondary"
                                onClick={cancelEdit}
                                disabled={isRowBusy}
                                title={t('cancel')}
                                aria-label={t('cancel')}
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
                            title={t('call')}
                            aria-label={t('call')}
                          >
                            📞
                          </button>
                        )}
                        {!isEditing && (
                          <button
                            className="secondary"
                            disabled={isRowBusy}
                            onClick={() => startEdit(it)}
                            title={t('edit')}
                            aria-label={t('edit')}
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={isRowBusy}
                          onClick={() => del(it.id)}
                          title={t('delete')}
                          aria-label={t('delete')}
                        >
                          🗑️
                        </button>
                        <button
                          className={`secondary ${!isPremium ? 'disabled' : ''}`}
                          disabled={!isPremium || isRowBusy}
                          onClick={() => favContact(it)}
                          aria-label={
                            isPremium
                              ? (it.is_favorite ? t('unfavorite') : t('favorite'))
                              : t('onlyPremiumShort')
                          }
                          title={
                            isPremium
                              ? (it.is_favorite ? t('unfavorite') : t('favoriteOne'))
                              : t('onlyPremiumShort')
                          }
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
            <div className="muted">{t('premiumHint')}</div>
          )}
        </div>
      </header>
    </div>
  );
}
