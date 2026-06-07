import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setToken, getToken } from '../auth';
import { api } from '../api';
import { useI18n } from '../i18n/context';
import LanguageSwitcher from '../i18n/switcher';

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

// Provider list — each has an id matching the API route param and an i18n key
const PROVIDERS = [
  { id: 'github', btnKey: 'login.github_btn' },
  { id: 'google', btnKey: 'login.google_btn' },
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
        <h1 style={S.title}>{t('brand.name')}</h1>
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
              {loading === prov.id ? t('login.connecting') : t(prov.btnKey)}
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
