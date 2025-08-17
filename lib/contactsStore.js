const KEY = 'aura_contact_v1';
// Estructura: { name, phone }

export function loadContact() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.name || !parsed?.phone) return null;
    return {
      name: String(parsed.name).slice(0, 80),
      phone: String(parsed.phone).slice(0, 40),
    };
  } catch {
    return null;
  }
}

export function saveContact(contact) {
  if (typeof window === 'undefined') return;
  const safe = {
    name: String(contact?.name || '').slice(0, 80),
    phone: String(contact?.phone || '').slice(0, 40),
  };
  localStorage.setItem(KEY, JSON.stringify(safe));
}

export function deleteContact() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
