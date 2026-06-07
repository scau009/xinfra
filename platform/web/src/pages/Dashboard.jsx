import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { clearToken } from '../auth';
import { useI18n } from '../i18n/context';
import LanguageSwitcher from '../i18n/switcher';

const S = {
  wrap: { minHeight:'100vh',maxWidth:'960px',margin:'0 auto',padding:'0 24px' },
  topbar: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'24px 0',borderBottom:'1px solid var(--border)',
    marginBottom:'44px',
  },
  logo: {
    fontSize:'15px',fontWeight:600,letterSpacing:'0.25em',
    textTransform:'uppercase',
  },
  logout: {
    padding:'7px 18px',backgroundColor:'transparent',
    color:'var(--text-dim)',border:'1px solid var(--border)',
    fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.1em',
    transition:'all .15s',
  },
  header: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    marginBottom:'36px',
  },
  heading: {
    fontSize:'13px',fontWeight:500,textTransform:'uppercase',
    letterSpacing:'0.15em',color:'var(--text-dim)',
  },
  newBtn: {
    padding:'9px 20px',backgroundColor:'var(--accent)',
    color:'var(--bg)',border:'none',fontSize:'12px',
    fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',
    transition:'opacity .15s',
  },
  form: {
    display:'flex',gap:'10px',marginBottom:'32px',
    padding:'18px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',
    animation:'slideDown .2s ease',
  },
  input: {
    flex:1,padding:'11px 16px',
    backgroundColor:'var(--bg)',color:'var(--text)',
    border:'1px solid var(--border)',
    outline:'none',fontSize:'13px',
    transition:'border-color .15s',
  },
  submit: {
    padding:'11px 22px',backgroundColor:'var(--accent)',
    color:'var(--bg)',border:'none',fontWeight:600,
    fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.1em',
    whiteSpace:'nowrap',
  },
  list: { display:'flex',flexDirection:'column',gap:'1px' },
  card: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'20px 22px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',
    textDecoration:'none',color:'var(--text)',
    transition:'all .15s',
  },
  cardName: { fontSize:'14px',fontWeight:500,marginBottom:'4px' },
  cardDomain: { fontSize:'12px',color:'var(--text-muted)' },
  arrow: { fontSize:'18px',color:'var(--text-muted)',transition:'all .15s' },
  empty: {
    textAlign:'center',padding:'80px 20px',color:'var(--text-muted)',
    border:'1px dashed var(--border)',
  },
  emptyTitle: { fontSize:'15px',marginBottom:'8px',color:'var(--text-dim)' },
  emptyDesc: { fontSize:'13px',lineHeight:1.8 },
  errorMsg: {
    padding:'12px 18px',marginBottom:'16px',
    backgroundColor:'transparent',color:'var(--danger)',
    border:'1px solid var(--danger)',
    fontSize:'12px',
  },
  cardActions: { display:'flex',alignItems:'center',gap:'12px' },
  delIcon: {
    fontSize:'18px',color:'var(--text-muted)',cursor:'pointer',
    padding:'2px 6px',border:'none',backgroundColor:'transparent',
    transition:'all .15s',lineHeight:1,
  },
  cardConfirm: {
    display:'flex',flexDirection:'column',gap:'10px',
    padding:'14px 18px',borderTop:'1px solid var(--danger)',
    backgroundColor:'var(--surface)',
  },
  cardConfirmText: { fontSize:'12px',color:'var(--danger)' },
  cardConfirmRow: { display:'flex',gap:'8px' },
  cardConfirmBtn: {
    padding:'5px 12px',backgroundColor:'var(--danger)',color:'var(--bg)',
    border:'none',fontSize:'11px',fontWeight:600,textTransform:'uppercase',
    letterSpacing:'0.1em',cursor:'pointer',
  },
  cardCancelBtn: {
    padding:'5px 12px',backgroundColor:'transparent',color:'var(--text-dim)',
    border:'1px solid var(--border)',fontSize:'11px',fontWeight:600,
    textTransform:'uppercase',letterSpacing:'0.1em',cursor:'pointer',
  },
};

export default function Dashboard() {
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const url = new URL(repoUrl);
      const repoName = url.pathname.split('/').pop()?.replace('.git','')||'unnamed';
      const project = await api.createProject({repoUrl,repoName,sourceType:'github'});
      const deploy = await api.deployProject(project.id);
      setProjects([{...project, deploys:[deploy]}, ...projects]);
      setShowCreate(false);
      setRepoUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(projectId) {
    setDeleting(true);
    try {
      await api.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.topbar}>
        <span style={S.logo}>{t('brand.name')}</span>
        <div style={{display:'flex',alignItems:'center',gap:'18px'}}>
          <LanguageSwitcher />
          <button
            style={S.logout}
            onClick={clearToken}
          onMouseEnter={e=>{e.target.style.borderColor='var(--text-dim)';e.target.style.color='var(--text)'}}
          onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--text-dim)'}}
        >{t('nav.logout')}</button>
        </div>
      </div>

      <div style={S.header}>
        <span style={S.heading}>{t('dashboard.heading')}</span>
        <button
          style={S.newBtn}
          onClick={()=>setShowCreate(!showCreate)}
          onMouseEnter={e=>e.target.style.opacity='0.85'}
          onMouseLeave={e=>e.target.style.opacity='1'}
        >{t('dashboard.new_btn')}</button>
      </div>

      {error && <div style={S.errorMsg}>! {error}</div>}

      {showCreate && (
        <form onSubmit={handleCreate} style={S.form}>
          <input
            type="text" value={repoUrl}
            onChange={e=>setRepoUrl(e.target.value)}
            placeholder={t('dashboard.repo_placeholder')}
            style={S.input}
            autoFocus
            onFocus={e=>e.target.style.borderColor='var(--border-light)'}
            onBlur={e=>e.target.style.borderColor='var(--border)'}
          />
          <button type="submit" disabled={creating} style={{
            ...S.submit,
            opacity:creating?0.5:1,
            cursor:creating?'wait':'pointer',
          }}>
            {creating ? t('dashboard.creating') : t('dashboard.deploy_btn')}
          </button>
        </form>
      )}

      {loading ? (
        <div style={S.empty}>
          <span style={{animation:'pulse 1.5s ease infinite',color:'var(--text-dim)'}}>{t('dashboard.loading')}</span>
        </div>
      ) : projects.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyTitle}>{t('dashboard.empty_title')}</div>
          <div style={S.emptyDesc}>
            {t('dashboard.empty_desc').split('\n').map((line, i) => (
              <span key={i}>{i > 0 && <br />}{line}</span>
            ))}
          </div>
        </div>
      ) : (
        <div style={S.list}>
          {projects.map(p=>(
            <div key={p.id}>
              <div
                style={S.card}
                onMouseEnter={e=>{
                  e.currentTarget.style.borderColor='var(--border-light)';
                  e.currentTarget.style.backgroundColor='var(--surface2)';
                  const arrow = e.currentTarget.querySelector('.card-arrow');
                  if(arrow) arrow.style.color='var(--text)';
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.borderColor='var(--border)';
                  e.currentTarget.style.backgroundColor='var(--surface)';
                  const arrow = e.currentTarget.querySelector('.card-arrow');
                  if(arrow) arrow.style.color='var(--text-muted)';
                }}
              >
                <Link to={`/projects/${p.id}`} style={{...S.card,flex:1,border:'none',textDecoration:'none',color:'var(--text)',backgroundColor:'transparent',padding:'0'}}>
                  <div>
                    <div style={S.cardName}>{p.repo_name}</div>
                    <div style={S.cardDomain}>{p.domain}</div>
                  </div>
                </Link>
                <div style={S.cardActions}>
                  <button
                    style={S.delIcon}
                    title="Delete project"
                    onClick={(e) => { e.preventDefault(); setDeleteTarget(deleteTarget === p.id ? null : p.id); }}
                    onMouseEnter={e=>{e.target.style.color='var(--danger)'}}
                    onMouseLeave={e=>{e.target.style.color='var(--text-muted)'}}
                  >×</button>
                  <Link to={`/projects/${p.id}`} style={{textDecoration:'none',color:'var(--text-muted)'}}>
                    <span className="card-arrow" style={S.arrow}>&rarr;</span>
                  </Link>
                </div>
              </div>
              {deleteTarget === p.id && (
                <div style={S.cardConfirm}>
                  <span style={S.cardConfirmText}>{t('dashboard.confirm_text', { name: p.repo_name })}</span>
                  <div style={S.cardConfirmRow}>
                    <button
                      style={S.cardConfirmBtn}
                      disabled={deleting}
                      onClick={() => handleDelete(p.id)}
                      onMouseEnter={e=>e.target.style.opacity='0.85'}
                      onMouseLeave={e=>e.target.style.opacity='1'}
                    >
                      {deleting ? t('dashboard.creating') : t('dashboard.confirm_delete')}
                    </button>
                    <button
                      style={S.cardCancelBtn}
                      disabled={deleting}
                      onClick={() => setDeleteTarget(null)}
                      onMouseEnter={e=>{e.target.style.borderColor='var(--text-dim)';e.target.style.color='var(--text)'}}
                      onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--text-dim)'}}
                    >
                      {t('dashboard.confirm_cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
