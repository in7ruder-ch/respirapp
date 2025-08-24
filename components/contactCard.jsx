'use client';

import { useEffect, useState } from 'react';
import '@/styles/ContactCard.css';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}
function smsHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `sms:${clean}` : '#';
}

export default function ContactCard({
  onSaved,
  showDelete = true,
  showSMS = true,
  hideTitle = false,
  showQuickActions = true,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const hasContact = name.trim() && phone.trim();

  // --- API helpers ---
  async function apiGet() {
    const res = await fetch('/api/contact', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al cargar contacto');
    return json; // { ok, contact }
  }
  async function apiPost(payload) {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al guardar contacto');
    return json; // { ok, contact }
  }
  async function apiDelete() {
    const res = await fetch('/api/contact', { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Error al borrar contacto');
    return json; // { ok:true }
  }

  // --- cargar al montar ---
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const { contact } = await apiGet(); // contact | null
        setName(contact?.name || '');
        setPhone(contact?.phone || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e) {
    e?.preventDefault?.();
    if (!hasContact) return;
    try {
      setSaving(true);
      setError('');
      const payload = { name: name.trim(), phone: phone.trim() };
      const { contact } = await apiPost(payload);
      setName(contact.name || '');
      setPhone(contact.phone || '');
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
      if (typeof onSaved === 'function') onSaved(contact);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!hasContact) return;
    if (!confirm('¿Eliminar contacto de emergencia?')) return;
    try {
      setSaving(true);
      setError('');
      await apiDelete();
      setName('');
      setPhone('');
      if (typeof onSaved === 'function') onSaved(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const callDisabled = !hasContact;

  return (
    <div className="contact-card">
      {!hideTitle && <h3 className="contact-title">Tu contacto</h3>}

      {error && <div className="alert-error">⚠️ {error}</div>}
      {loading ? (
        <div className="cc-loading">Cargando…</div>
      ) : (
        <form className="contact-form" onSubmit={handleSave}>
          <label className="field">
            <span className="label">Nombre</span>
            <input
              className="input"
              type="text"
              placeholder="Ej: Mamá"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
            />
          </label>

          <label className="field">
            <span className="label">Teléfono</span>
            <input
              className="input"
              type="tel"
              placeholder="+54 9 11 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              required
            />
          </label>

          <div className="actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!hasContact || saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>

            {showDelete && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={!hasContact || saving}
              >
                Borrar
              </button>
            )}
          </div>
        </form>
      )}

      {saved && <div className="alert-success">✅ Contacto guardado</div>}

      {showQuickActions && !loading && (
        <>
          <div className="quick-actions">
            <a
              href={telHref(phone)}
              onClick={(e) => callDisabled && e.preventDefault()}
              aria-disabled={callDisabled}
              className={`btn btn-call${callDisabled ? ' disabled' : ''}`}
              title={callDisabled ? 'Guardá un contacto primero' : `Llamar a ${name || 'contacto'}`}
            >
              📞 Llamar
            </a>

            {showSMS && (
              <a
                href={smsHref(phone)}
                onClick={(e) => callDisabled && e.preventDefault()}
                aria-disabled={callDisabled}
                className={`btn btn-sms${callDisabled ? ' disabled' : ''}`}
                title={callDisabled ? 'Guardá un contacto primero' : `SMS a ${name || 'contacto'}`}
              >
                ✉️ SMS
              </a>
            )}
          </div>
          <p className="helper">
            En móvil abrirá la app de llamadas. En desktop puede que no haga nada.
          </p>
        </>
      )}
    </div>
  );
}
