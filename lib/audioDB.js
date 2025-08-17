// src/utils/audioDB.js
const DB_NAME = 'paNICO-audio';
const DB_VERSION = 2;           // subimos versión para forzar upgrade si algo quedó viejo
const STORE_NAME = 'audioStore';
const KEY = 'customAudio';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB'));
  });
}

export async function saveAudioBlob(blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put(blob, KEY);

    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error || new Error('Transacción abortada al guardar audio.'));
    tx.onerror = () =>
      reject(tx.error || new Error('Error de transacción al guardar audio.'));
  });
}

export async function getAudioBlob() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () =>
      reject(req.error || new Error('No se pudo obtener el audio.'));
  });
}

export async function deleteAudioBlob() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY);

    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error || new Error('Transacción abortada al eliminar audio.'));
    tx.onerror = () =>
      reject(tx.error || new Error('Error de transacción al eliminar audio.'));
  });
}
