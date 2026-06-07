import { useEffect, useState } from 'react';
import { api } from '../api';
import { useI18n } from '../i18n/context';
import LanguageSwitcher from '../i18n/switcher';
import Logo from '../components/Logo';

const S = {
  // Layout
  wrap: { position:'relative',zIndex:1 },
  section: { padding:'80px 24px',maxWidth:'960px',margin:'0 auto' },
  sectionAlt: { padding:'80px 24px',maxWidth:'960px',margin:'0 auto',borderTop:'1px solid var(--border)' },

  // Top nav
  nav: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'20px 24px',maxWidth:'960px',margin:'0 auto',
    borderBottom:'1px solid var(--border)',
  },
  logo: {
    fontSize:'14px',fontWeight:600,letterSpacing:'0.3em',
    textTransform:'uppercase',color:'var(--text)',
  },
  navLinks: { display:'flex',gap:'24px',alignItems:'center' },
  navLink: {
    fontSize:'12px',color:'var(--text-dim)',textTransform:'uppercase',
    letterSpacing:'0.12em',textDecoration:'none',transition:'color .15s',
    background:'none',border:'none',fontFamily:'var(--font)',cursor:'pointer',
  },

  // Hero
  hero: { padding:'100px 24px 80px',maxWidth:'960px',margin:'0 auto',textAlign:'center' },
  ascii: {
    fontSize:'11px',lineHeight:1.25,color:'var(--text-dim)',
    whiteSpace:'pre',marginBottom:'40px',userSelect:'none',
    display:'inline-block',textAlign:'left',
    animation:'fadeIn .8s ease',
  },
  heroTitle: {
    fontSize:'clamp(32px,6vw,56px)',fontWeight:400,
    letterSpacing:'0.05em',marginBottom:'20px',
    animation:'fadeIn .6s ease .2s both',
  },
  heroTagline: {
    fontSize:'15px',color:'var(--text-dim)',marginBottom:'48px',
    maxWidth:'520px',margin:'0 auto 48px',lineHeight:1.8,
    animation:'fadeIn .6s ease .3s both',
  },
  heroCtaRow: {
    display:'flex',gap:'12px',justifyContent:'center',
    animation:'fadeIn .6s ease .4s both',
  },
  btnPrimary: {
    display:'inline-flex',alignItems:'center',gap:'8px',
    padding:'14px 36px',fontSize:'13px',fontWeight:500,
    backgroundColor:'var(--accent)',color:'var(--bg)',
    border:'1px solid var(--accent)',cursor:'pointer',
    textTransform:'uppercase',letterSpacing:'0.15em',
    fontFamily:'var(--font)',transition:'opacity .15s',
  },
  btnGhost: {
    display:'inline-flex',alignItems:'center',gap:'8px',
    padding:'14px 36px',fontSize:'13px',fontWeight:500,
    backgroundColor:'transparent',color:'var(--text)',
    border:'1px solid var(--border-light)',cursor:'pointer',
    textTransform:'uppercase',letterSpacing:'0.15em',
    fontFamily:'var(--font)',transition:'all .15s',
  },
  cursor: {
    display:'inline-block',width:'10px',height:'18px',
    backgroundColor:'var(--accent)',
    animation:'blink 1s step-end infinite',
    verticalAlign:'text-bottom',marginLeft:'2px',
  },

  // Section headers
  sectionLabel: {
    fontSize:'11px',fontWeight:500,textTransform:'uppercase',
    letterSpacing:'0.2em',color:'var(--text-muted)',marginBottom:'12px',
  },
  sectionTitle: {
    fontSize:'22px',fontWeight:400,letterSpacing:'0.05em',
    marginBottom:'16px',
  },
  sectionDesc: {
    fontSize:'14px',color:'var(--text-dim)',lineHeight:1.8,
    maxWidth:'560px',marginBottom:'48px',
  },

  // Feature grid
  featureGrid: {
    display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',
    gap:'1px',backgroundColor:'var(--border)',
    border:'1px solid var(--border)',
  },
  featureCard: {
    padding:'28px 24px',backgroundColor:'var(--bg)',
    transition:'all .15s',
  },
  featureIcon: {
    fontSize:'20px',marginBottom:'14px',color:'var(--text-dim)',
  },
  featureTitle: {
    fontSize:'14px',fontWeight:500,textTransform:'uppercase',
    letterSpacing:'0.1em',marginBottom:'8px',
  },
  featureDesc: {
    fontSize:'13px',color:'var(--text-muted)',lineHeight:1.7,
  },

  // Pipeline
  pipeline: {
    display:'flex',alignItems:'center',gap:'0',
    padding:'32px 0',overflowX:'auto',
    fontFamily:'var(--font)',
  },
  pipelineStep: {
    flex:'0 0 auto',padding:'20px 24px',
    backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',
    textAlign:'center',minWidth:'140px',
  },
  pipelineArrow: {
    padding:'0 12px',color:'var(--text-muted)',
    fontSize:'18px',flexShrink:0,
  },
  pipelineLabel: {
    fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',
    letterSpacing:'0.15em',marginBottom:'6px',
  },
  pipelineTitle: {
    fontSize:'13px',fontWeight:500,textTransform:'uppercase',
    letterSpacing:'0.08em',
  },

  // Supported frameworks
  frameworkList: {
    display:'flex',flexWrap:'wrap',gap:'8px',marginTop:'32px',
  },
  frameworkTag: {
    padding:'8px 16px',fontSize:'11px',color:'var(--text-dim)',
    border:'1px solid var(--border)',fontFamily:'var(--font)',
    textTransform:'uppercase',letterSpacing:'0.1em',
    backgroundColor:'var(--surface)',
  },

  // CTA section
  cta: {
    padding:'100px 24px',maxWidth:'960px',margin:'0 auto',
    textAlign:'center',borderTop:'1px solid var(--border)',
    borderBottom:'1px solid var(--border)',
  },
  ctaTitle: {
    fontSize:'20px',fontWeight:400,letterSpacing:'0.05em',
    marginBottom:'12px',
  },
  ctaDesc: {
    fontSize:'14px',color:'var(--text-dim)',marginBottom:'40px',
    lineHeight:1.8,
  },

  // CJK text
  zhTitle: {
    fontFamily:'var(--font-cjk)',fontSize:'clamp(16px,3vw,20px)',
    fontWeight:300,color:'var(--text-dim)',letterSpacing:'0.05em',
    marginTop:'8px',lineHeight:1.6,
  },
  zhSub: {
    fontFamily:'var(--font-cjk)',fontSize:'14px',fontWeight:300,
    color:'var(--text-muted)',letterSpacing:'0.03em',
    lineHeight:1.8,fontStyle:'normal',
  },
  zhFeature: {
    fontFamily:'var(--font-cjk)',fontSize:'12px',fontWeight:300,
    color:'var(--text-muted)',lineHeight:1.7,letterSpacing:'0.02em',
    marginTop:'4px',
  },

  // Footer
  footer: {
    padding:'48px 24px',maxWidth:'960px',margin:'0 auto',
    display:'flex',justifyContent:'space-between',alignItems:'center',
    flexWrap:'wrap',gap:'16px',
  },
  footerText: { fontSize:'12px',color:'var(--text-muted)' },
  footerLinks: { display:'flex',gap:'20px' },
  footerLink: {
    fontSize:'12px',color:'var(--text-dim)',textTransform:'uppercase',
    letterSpacing:'0.1em',textDecoration:'none',transition:'color .15s',
  },
};

const ASCII_LINES = [
  `    ⣠⣶⣶⣦⣄⠀⠀⠀⠀⣠⣶⣶⣦⡀`,
  `    ⣿⣿⣿⣿⣿⡇⠀⠀⢠⣿⣿⣿⣿⣿`,
  `    ⠘⣿⣿⣿⣿⠃⠀⠀⢸⣿⣿⣿⣿⡇`,
  `    ⠀⠘⠛⠛⠛⠀⠀⠀⠀⠘⠛⠛⠟⠃`,
];

const FEATURE_KEYS = [
  { icon:'>', titleKey:'feature.zero_config.title', zhKey:'feature.zero_config.zh', descKey:'feature.zero_config.desc' },
  { icon:'#', titleKey:'feature.auto_deploy.title', zhKey:'feature.auto_deploy.zh', descKey:'feature.auto_deploy.desc' },
  { icon:'*', titleKey:'feature.auto_ssl.title', zhKey:'feature.auto_ssl.zh', descKey:'feature.auto_ssl.desc' },
  { icon:'~', titleKey:'feature.live_logs.title', zhKey:'feature.live_logs.zh', descKey:'feature.live_logs.desc' },
  { icon:'$', titleKey:'feature.env_vars.title', zhKey:'feature.env_vars.zh', descKey:'feature.env_vars.desc' },
  { icon:'@', titleKey:'feature.own_stack.title', zhKey:'feature.own_stack.zh', descKey:'feature.own_stack.desc' },
];

const STEP_KEYS = [
  { labelKey:'pipeline.step1.label', titleKey:'pipeline.step1.title', zhKey:'pipeline.step1.zh' },
  { labelKey:'pipeline.step2.label', titleKey:'pipeline.step2.title', zhKey:'pipeline.step2.zh' },
  { labelKey:'pipeline.step3.label', titleKey:'pipeline.step3.title', zhKey:'pipeline.step3.zh' },
  { labelKey:'pipeline.step4.label', titleKey:'pipeline.step4.title', zhKey:'pipeline.step4.zh' },
  { labelKey:'pipeline.step5.label', titleKey:'pipeline.step5.title', zhKey:'pipeline.step5.zh' },
];

const FRAMEWORKS = [
  'Next.js','Express','React','Vue','Svelte',
  'Static HTML','Dockerfile','Node.js','Python','Go',
];

export default function Landing() {
  const { t, lang } = useI18n();
  const [loginUrl, setLoginUrl] = useState(null);

  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    api.getLoginUrl('github').then(({ url }) => setLoginUrl(url)).catch(() => {});
  }, []);

  function handleLogin(provider) {
    // Normalize: React onClick passes event as first arg, direct calls pass string
    const p = typeof provider === 'string' ? provider : 'github';
    if (loginLoading) return;
    setLoginLoading(true);
    // Use pre-fetched URL if available and matching, otherwise fetch on demand
    const doRedirect = (url) => { window.location.href = url; };

    if (p === 'github' && loginUrl) {
      doRedirect(loginUrl);
      return;
    }

    api.getLoginUrl(p).then(({ url }) => {
      doRedirect(url);
    }).catch(() => {
      setLoginLoading(false);
    });
  }

  return (
    <div style={S.wrap}>

      {/* ── Navigation ── */}
      <nav style={S.nav}>
        <Logo size={20} />
        <div style={S.navLinks}>
          <LanguageSwitcher />
          <a href="#features" style={S.navLink}
            onMouseEnter={e=>e.target.style.color='var(--text)'}
            onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
          >{t('nav.features')}</a>
          <a href="#how" style={S.navLink}
            onMouseEnter={e=>e.target.style.color='var(--text)'}
            onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
          >{t('nav.how')}</a>
          <button style={{
            ...S.navLink,
            padding:'6px 16px',border:'1px solid var(--border-light)',
          }}
            onClick={handleLogin}
            disabled={loginLoading}
            onMouseEnter={e=>{e.target.style.borderColor='var(--text)';e.target.style.color='var(--text)'}}
            onMouseLeave={e=>{e.target.style.borderColor='var(--border-light)';e.target.style.color='var(--text-dim)'}}
          >{loginLoading ? '...' : t('nav.login')}</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={S.hero}>
        <div style={S.ascii}>{ASCII_LINES.join('\n')}</div>
        <h1 style={S.heroTitle}>{t('landing.hero.title')}</h1>
        {lang === 'zh' && <p style={S.zhTitle}>{t('landing.hero.subtitle')}</p>}
        <p style={S.heroTagline}>
          {t('landing.hero.desc')}
        </p>
        {lang === 'zh' && <p style={{...S.zhSub, maxWidth:'480px',margin:'-32px auto 48px'}}>
          {t('landing.hero.zh_desc')}
        </p>}
        <div style={S.heroCtaRow}>
          <button style={S.btnPrimary}
            onClick={handleLogin}
            disabled={loginLoading}
            onMouseEnter={e=>e.target.style.opacity='0.85'}
            onMouseLeave={e=>e.target.style.opacity='1'}
          >
            {loginLoading ? '...' : t('landing.hero.cta')}
            {!loginLoading && <span style={S.cursor} />}
          </button>
          <a href="/login" style={S.btnGhost}
            onMouseEnter={e=>{e.target.style.borderColor='var(--text)';e.target.style.backgroundColor='var(--surface)'}}
            onMouseLeave={e=>{e.target.style.borderColor='var(--border-light)';e.target.style.backgroundColor='transparent'}}
          >
            {t('landing.hero.cta_secondary')}
          </a>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={S.sectionAlt}>
        <div style={S.sectionLabel}>{t('landing.features.label')}</div>
        <h2 style={S.sectionTitle}>{t('landing.features.title')}</h2>
        {lang === 'zh' && <p style={{...S.zhSub,fontSize:'15px',marginBottom:'8px'}}>{t('landing.features.zh_sub')}</p>}
        <p style={S.sectionDesc}>
          {t('landing.features.desc')}
        </p>
        <div style={S.featureGrid}>
          {FEATURE_KEYS.map((f, i) => (
            <div key={i} style={{
              ...S.featureCard,
              animation:`fadeIn .5s ease ${0.1*i}s both`,
            }}
              onMouseEnter={e=>{e.currentTarget.style.backgroundColor='var(--surface)'}}
              onMouseLeave={e=>{e.currentTarget.style.backgroundColor='var(--bg)'}}
            >
              <div style={S.featureIcon}>{f.icon}</div>
              <h3 style={S.featureTitle}>{t(f.titleKey)}</h3>
              {lang === 'zh' && <p style={S.zhFeature}>{t(f.zhKey)}</p>}
              <p style={S.featureDesc}>{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" style={S.section}>
        <div style={S.sectionLabel}>{t('landing.pipeline.label')}</div>
        <h2 style={S.sectionTitle}>{t('landing.pipeline.title')}</h2>
        {lang === 'zh' && <p style={{...S.zhSub,fontSize:'15px',marginBottom:'8px'}}>{t('landing.pipeline.zh_sub')}</p>}
        <p style={S.sectionDesc}>
          {t('landing.pipeline.desc')}
        </p>
        <div style={S.pipeline}>
          {STEP_KEYS.map((s, i) => (
            <>
              <div key={i} style={S.pipelineStep}>
                <div style={S.pipelineLabel}>{t(s.labelKey)}</div>
                <div style={S.pipelineTitle}>{t(s.titleKey)}</div>
                {lang === 'zh' && <div style={{...S.zhFeature,fontSize:'11px',marginTop:'4px'}}>{t(s.zhKey)}</div>}
              </div>
              {i < STEP_KEYS.length - 1 && (
                <span style={S.pipelineArrow}>&rarr;</span>
              )}
            </>
          ))}
        </div>

        <div style={S.sectionLabel}>{t('landing.frameworks.label')}</div>
        <div style={S.frameworkList}>
          {FRAMEWORKS.map(f => (
            <span key={f} style={S.frameworkTag}>{f}</span>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={S.cta}>
        <h2 style={S.ctaTitle}>{t('landing.cta.title')}</h2>
        {lang === 'zh' && <p style={{...S.zhSub,fontSize:'15px',marginBottom:'8px'}}>{t('landing.cta.zh_sub')}</p>}
        <p style={S.ctaDesc}>
          {lang === 'zh' ? t('landing.cta.zh_desc') : t('landing.cta.desc')}
        </p>
        <button style={S.btnPrimary}
          onClick={handleLogin}
          disabled={loginLoading}
          onMouseEnter={e=>e.target.style.opacity='0.85'}
          onMouseLeave={e=>e.target.style.opacity='1'}
        >
          {loginLoading ? '...' : t('landing.cta.btn')}
          {!loginLoading && <span style={S.cursor} />}
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={S.footer}>
        <span style={S.footerText}>
          {t('landing.footer')}
        </span>
        <div style={S.footerLinks}>
          <a href="#features" style={S.footerLink}
            onMouseEnter={e=>e.target.style.color='var(--text)'}
            onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
          >{t('footer.features')}</a>
          <a href="#how" style={S.footerLink}
            onMouseEnter={e=>e.target.style.color='var(--text)'}
            onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
          >{t('footer.how')}</a>
          <button onClick={handleLogin}
            disabled={loginLoading}
            style={{
            ...S.footerLink,background:'none',border:'none',
            fontFamily:'var(--font)',cursor:'pointer',
          }}
            onMouseEnter={e=>e.target.style.color='var(--text)'}
            onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
          >{loginLoading ? '...' : t('footer.login')}</button>
        </div>
      </footer>

    </div>
  );
}
