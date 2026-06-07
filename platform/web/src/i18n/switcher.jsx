import { useI18n } from './context';

const S = {
  wrap: {
    display:'inline-flex',alignItems:'center',gap:'4px',
    fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.1em',
    fontFamily:'var(--font)',userSelect:'none',
  },
  btn: (active) => ({
    background:'none',border:'none',padding:'3px 6px',
    fontFamily:'var(--font)',fontSize:'11px',cursor:'pointer',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    textTransform:'uppercase',letterSpacing:'0.1em',
    transition:'color .15s',
  }),
  sep: {
    color:'var(--border-light)',fontSize:'10px',
  },
};

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div style={S.wrap}>
      <button
        style={S.btn(lang === 'en')}
        onClick={() => setLang('en')}
        onMouseEnter={e => { if (lang !== 'en') e.target.style.color = 'var(--text-dim)'; }}
        onMouseLeave={e => { if (lang !== 'en') e.target.style.color = 'var(--text-muted)'; }}
      >EN</button>
      <span style={S.sep}>|</span>
      <button
        style={S.btn(lang === 'zh')}
        onClick={() => setLang('zh')}
        onMouseEnter={e => { if (lang !== 'zh') e.target.style.color = 'var(--text-dim)'; }}
        onMouseLeave={e => { if (lang !== 'zh') e.target.style.color = 'var(--text-muted)'; }}
      >中文</button>
    </div>
  );
}
