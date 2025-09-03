'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

const fetcher = (u)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function LibraryPage() {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);

  // Plan (para habilitar ⭐ solo en premium)
  const { data: planData } = useSWR('/api/me/plan', fetcher, { revalidateOnFocus:true, dedupingInterval:1500 });
  const tier = planData?.tier || 'free';
  const isPremium = tier === 'premium';

  // Lista de media
  const { data: listData, error, isLoading, mutate } = useSWR('/api/media/list', fetcher, { revalidateOnFocus:true, dedupingInterval:1500 });
  const items = listData?.items || [];

  async function play(id) {
    setBusyId(id);
    try {
      const res = await fetch('/api/media/sign-download', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'PLAY_ERROR');
      // Reprod simple: abrimos el recurso en la misma pestaña
      window.location.href = j.url;
    } catch (e) {
      alert('No se pudo reproducir el mensaje.');
    } finally {
      setBusyId(null);
    }
  }

  async function del(id) {
    if (!confirm('¿Borrar este mensaje?')) return;
    setBusyId(id);
    try {
      const res = await fetch('/api/media/delete', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'DELETE_ERROR');
      mutate(); // refrescar lista
    } catch (e) {
      alert('No se pudo borrar el mensaje.');
    } finally {
      setBusyId(null);
    }
  }

  async function fav(id) {
    if (!isPremium) return alert('Favoritos es una función Premium.');
    setBusyId(id);
    try {
      const res = await fetch('/api/media/favorite', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'FAV_ERROR');
      mutate();
    } catch (e) {
      alert(e?.message === 'ONLY_PREMIUM' ? 'Solo Premium puede marcar favorito.' : 'No se pudo marcar favorito.');
    } finally {
      setBusyId(null);
    }
  }

  const activeNav = 'library';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ padding: 16 }}>
          <h2>📚 Biblioteca</h2>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="primary" onClick={()=>router.push('/message')}>
              🎙️ Grabar
            </button>
            <a className="underline" href="/premium" style={{ alignSelf:'center' }}>
              {isPremium ? 'Plan: PREMIUM' : '¿Tenés un código Premium?'}
            </a>
          </div>

          {/* Lista */}
          <div style={{ marginTop: 16 }}>
            {isLoading ? <p>Cargando…</p> : error ? (
              <p className="text-red-600">Error al cargar la biblioteca.</p>
            ) : items.length === 0 ? (
              <p className="muted">No tenés mensajes aún. Grabá tu primer mensaje con el botón de arriba.</p>
            ) : (
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {items.map((it) => {
                  const dt = new Date(it.created_at);
                  const when = isNaN(dt) ? '' : dt.toLocaleString();
                  return (
                    <li key={it.id} className="library-row" style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, padding:'10px 0', borderBottom:'1px solid #eee' }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{it.kind?.toUpperCase()}</div>
                        <div className="muted" style={{ fontSize:12 }}>{when}</div>
                        {it.is_favorite && <div style={{ fontSize:12, color:'#0a0' }}>★ Favorito</div>}
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button
                          className="secondary"
                          disabled={busyId === it.id}
                          onClick={()=>play(it.id)}
                          title="Reproducir"
                        >▶</button>
                        <button
                          className="secondary"
                          disabled={busyId === it.id}
                          onClick={()=>del(it.id)}
                          title="Borrar"
                        >🗑️</button>
                        <button
                          className={`secondary ${!isPremium ? 'disabled' : ''}`}
                          disabled={!isPremium || busyId === it.id}
                          onClick={()=>fav(it.id)}
                          title={isPremium ? 'Marcar favorito (uno máximo)' : 'Solo Premium'}
                        >⭐</button>
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
