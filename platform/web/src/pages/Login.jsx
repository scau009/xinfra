import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
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
  subtitle: {
    fontSize:'15px',color:'var(--text-dim)',marginBottom:'48px',
    maxWidth:'380px',margin:'0 auto 48px',lineHeight:1.8,
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
  divider: {
    width:'48px',height:'1px',backgroundColor:'var(--border-light)',
    margin:'40px auto',
  },
  footer: {
    fontSize:'12px',color:'var(--text-muted)',marginTop:'56px',
  },
};

// Brand-colored SVG icons
const ICONS = {
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  ),
  google: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09a6.62 6.62 0 0 1-.35-2.09c0-.72.12-1.42.35-2.09V7.07H2.18A10.82 10.82 0 0 0 1 12c0 1.77.42 3.44 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [typed, setTyped] = useState('');
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    const word = 'login';
    let i = 0;
    const timer = setInterval(() => {
      setTyped(word.slice(0, i + 1));
      i++;
      if (i >= word.length) {
        clearInterval(timer);
        setTypingDone(true);
      }
    }, 150);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <Link
          to="/"
          style={{
            display:'inline-block',marginBottom:'32px',
            fontSize:'12px',color:'var(--text-dim)',
            textTransform:'uppercase',letterSpacing:'0.1em',
            textDecoration:'none',transition:'color .15s',
          }}
          onMouseEnter={e=>e.target.style.color='var(--text)'}
          onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
        >{t('project.back')}</Link>
        <div style={{
          display:'flex',justifyContent:'center',alignItems:'baseline',
          marginBottom:'32px',fontFamily:'var(--font)',fontSize:'clamp(24px,4vw,36px)',
          fontWeight:300,color:'var(--text)',letterSpacing:'0.04em',
          animation:'fadeIn .4s ease both',
        }}>
          <span style={{color:'var(--text-dim)',marginRight:'6px'}}>&gt;&nbsp;</span>
          <span>{typed}</span>
          <span style={{
            display:'inline-block',
            width:'clamp(10px,1.5vw,14px)',
            height:'0.88em',
            backgroundColor:'var(--accent)',
            animation:'blink 1s step-end infinite',
            marginLeft:'2px',
          }} />
        </div>
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
