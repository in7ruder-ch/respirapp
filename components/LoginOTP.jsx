// components/LoginOTP.jsx
'use client';

import {useState} from 'react';
import {supabase} from '@lib/supabaseClient';
import {useTranslations} from 'next-intl';

export default function LoginOTP({onSuccess}) {
  const t = useTranslations('login');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('email');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  async function sendCode(e) {
    e?.preventDefault?.();
    setLoading(true);
    setInfo('');
    try {
      const {error} = await supabase.auth.signInWithOtp({email, options: {shouldCreateUser: true}});
      if (error) throw error;
      setStage('code');
      setInfo(t('sent')); // "Te enviamos un código..."
    } catch (err) {
      console.error(err);
      setInfo(t('sendError'));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e) {
    e?.preventDefault?.();
    setLoading(true);
    setInfo('');
    try {
      const {error} = await supabase.auth.verifyOtp({email, token: code, type: 'email'});
      if (error) throw error;
      setInfo(t('success'));
      onSuccess?.();
    } catch (err) {
      console.error(err);
      setInfo(t('invalidCode'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      {stage === 'email' ? (
        <form onSubmit={sendCode}>
          <h3>{t('signinTitle')}</h3>
          <p className="muted">{t('signinSubtitle')}</p>

          <input
            type="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            inputMode="email"
            style={{width: '100%', margin: '8px 0'}}
          />

          <button className="help-button" type="submit" disabled={loading}>
            {loading ? t('sending') : t('sendCode')}
          </button>

          {info && <p className="muted" style={{marginTop: 8}}>{info}</p>}
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <h3>{t('codeTitle')}</h3>
          <p className="muted">{t('codeSubtitle')}</p>

          <input
            type="text"
            placeholder={t('codePlaceholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            inputMode="numeric"
            style={{width: '100%', margin: '8px 0'}}
          />

          <button className="help-button" type="submit" disabled={loading}>
            {loading ? t('verifying') : t('verify')}
          </button>

          {info && <p className="muted" style={{marginTop: 8}}>{info}</p>}
        </form>
      )}
    </div>
  );
}
