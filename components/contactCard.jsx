'use client';

import { useEffect, useState } from 'react';
import { loadContact, saveContact, deleteContact } from '@/lib/contactsStore';
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
  showQuickActions = true, // 👈 nuevo
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  const hasContact = name.trim() && phone.trim();

  useEffect(() => {
    const c = loadContact();
    if (c) {
      setName(c.name || '');
      setPhone(c.phone || '');
    }
  }, []);

  function handleSave(e) {
    e?.preventDefault?.();
    if (!hasContact) return;
    const contact = { name: name.trim(), phone: phone.trim() };
    saveContact(contact);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
    if (typeof onSaved === 'function') onSaved(contact);
  }

  function handleDelete() {
    deleteContact();
    setName('');
    setPhone('');
    if (typeof onSaved === 'function') onSaved(null);
  }

  const callDisabled = !hasContact;

  return (
    <div className="contact-card">
      {!hideTitle && <h3 className="contact-title">Contacto de confianza</h3>}

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
          <button type="submit" className="btn btn-primary" disabled={!hasContact}>
            Guardar
          </button>

          {showDelete && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={!hasContact}
            >
              Borrar
            </button>
          )}
        </div>
      </form>

      {saved && <div className="alert-success">✅ Contacto guardado</div>}

      {showQuickActions && (
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
