import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setToken, getToken } from '../auth';
import { api } from '../api';

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

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      navigate('/');
      return;
    }
    if (getToken()) navigate('/');
  }, []);

  async function handleLogin() {
    setLoading(true);
    try {
      const { url } = await api.getLoginUrl();
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
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
        <h1 style={S.title}>Plat</h1>
        <p style={S.subtitle}>
          Deploy your code in seconds.<br/>Zero config. One command.
        </p>
        {error && (
          <div style={{
            color:'var(--danger)',fontSize:'13px',marginBottom:'20px',
            padding:'10px 16px',border:'1px solid var(--danger)',
            display:'inline-block',
          }}>! {error}</div>
        )}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...S.btn,
            opacity: loading ? 0.5 : 1,
            cursor: loading ? 'wait' : 'pointer',
          }}
          onMouseEnter={e => { if(!loading) e.target.style.borderColor='var(--text)'; }}
          onMouseLeave={e => { e.target.style.borderColor='var(--border-light)'; }}
        >
          {loading ? 'Connecting...' : 'Login with GitHub'}
          <span style={S.cursor} />
        </button>
        <div style={S.divider} />
        <p style={S.footer}>v0.1.0 — Alpha</p>
      </div>
    </div>
  );
}
