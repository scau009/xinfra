import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setToken, getToken } from '../auth';
import { api } from '../api';
import { useI18n } from '../i18n/context';
import LanguageSwitcher from '../i18n/switcher';
import Logo from '../components/Logo';

const S = {
  wrap: {
    display:'flex',alignItems:'center',justifyContent:'center',
    minHeight:'100vh',padding:'24px',
  },
  card: {
    textAlign:'center',maxWidth:'560px',width:'100%',
    animation:'fadeIn .6s ease',
  },
  ascii: {
    fontSize:'13px',lineHeight:1.3,color:'var(--text-dim)',
    whiteSpace:'pre',marginBottom:'48px',userSelect:'none',
    letterSpacing:'0',
  },
  title: {
    fontSize:'24px',fontWeight:500,letterSpacing:'0.3em',
    textTransform:'uppercase',marginBottom:'16px',
  },
  subtitle: {
    fontSize:'15px',color:'var(--text-dim)',marginBottom:'56px',
    maxWidth:'380px',margin:'0 auto 56px',lineHeight:1.8,
  },
  btn: {
    display:'inline-flex',alignItems:'center',gap:'10px',
    padding:'14px 40px',fontSize:'14px',fontWeight:500,
    backgroundColor:'transparent',color:'var(--text)',
    border:'1px solid var(--border-light)',cursor:'pointer',
    transition:'all .15s',
    textTransform:'uppercase',letterSpacing:'0.15em',
  },
  btnGroup: {
    display:'flex',flexDirection:'column',alignItems:'center',gap:'12px',
  },
  cursor: {
    display:'inline-block',width:'10px',height:'20px',
    backgroundColor:'var(--accent)',
    animation:'blink 1s step-end infinite',
    verticalAlign:'text-bottom',marginLeft:'2px',
  },
  divider: {
    width:'48px',height:'1px',backgroundColor:'var(--border-light)',
    margin:'40px auto',
  },
  footer: {
    fontSize:'12px',color:'var(--text-muted)',marginTop:'56px',
  },
};

// Simple inline SVG icons matching terminal brutalist style (monochrome, currentColor)
const ICONS = {
  github: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
    </svg>
  ),
  google: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 5.5A6.5 6.5 0 0 1 18.5 12M12 18.5A6.5 6.5 0 0 1 5.5 12M12 5.5v13M5.5 12h13" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      <path d="M8 8.5c2-2 5-2 7 0M8 15.5c2 2 5 2 7 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

// Provider list — each has an id matching the API route param and an i18n key
const PROVIDERS = [
  { id: 'github', btnKey: 'login.github_btn', icon: ICONS.github },
  { id: 'google', btnKey: 'login.google_btn', icon: ICONS.google },
];

export default function Login({ onLogin }) {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null); // which provider id is loading, null = none
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      if (onLogin) onLogin();
      navigate('/');
      return;
    }
    if (getToken()) navigate('/');
  }, []);

  async function handleLogin(providerId) {
    setLoading(providerId);
    setError(null);
    try {
      const { url } = await api.getLoginUrl(providerId);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setLoading(null);
    }
  }

  const ascii = `    ⠀⣠⣶⣶⣦⣄⠀⠀⠀⠀⣠⣶⣶⣦⡀
    ⠀⣿⣿⣿⣿⣿⡇⠀⠀⢠⣿⣿⣿⣿⣿
    ⠀⠘⣿⣿⣿⣿⠃⠀⠀⢸⣿⣿⣿⣿⡇
    ⠀⠀⠘⠛⠛⠛⠀⠀⠀⠀⠘⠛⠛⠟⠃`;

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.ascii}>{ascii}</div>
        <div style={{marginBottom:'32px'}}><Logo size={48} /></div>
        <p style={S.subtitle}>
          {t('login.subtitle').split('\n').map((line, i) => (
            <span key={i}>{i > 0 && <br />}{line}</span>
          ))}
        </p>
        {error && (
          <div style={{
            color:'var(--danger)',fontSize:'13px',marginBottom:'20px',
            padding:'10px 16px',border:'1px solid var(--danger)',
            display:'inline-block',
          }}>! {error}</div>
        )}
        <div style={S.btnGroup}>
          {PROVIDERS.map(prov => (
            <button
              key={prov.id}
              onClick={() => handleLogin(prov.id)}
              disabled={loading !== null}
              style={{
                ...S.btn,
                width:'280px',
                justifyContent:'center',
                opacity: loading !== null && loading !== prov.id ? 0.4 : 1,
                cursor: loading !== null ? 'wait' : 'pointer',
              }}
              onMouseEnter={e => { if(!loading) e.target.style.borderColor='var(--text)'; }}
              onMouseLeave={e => { e.target.style.borderColor='var(--border-light)'; }}
            >
              {loading === prov.id ? (
                t('login.connecting')
              ) : (
                <>
                  {prov.icon}
                  <span style={{marginLeft:'6px'}}>{t(prov.btnKey)}</span>
                </>
              )}
              {loading !== prov.id && <span style={S.cursor} />}
            </button>
          ))}
        </div>
        <div style={S.divider} />
        <p style={S.footer}>{t('login.footer')}</p>
        <div style={{marginTop:'24px'}}><LanguageSwitcher /></div>
      </div>
    </div>
  );
}
