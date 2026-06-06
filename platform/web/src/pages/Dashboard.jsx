import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { clearToken } from '../auth';

const S = {
  wrap: { minHeight:'100vh',maxWidth:'900px',margin:'0 auto',padding:'0 24px' },
  topbar: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'20px 0',borderBottom:'1px solid var(--border)',
    marginBottom:'40px',
  },
  logo: {
    fontSize:'13px',fontWeight:600,letterSpacing:'0.25em',
    textTransform:'uppercase',
  },
  logout: {
    padding:'6px 16px',backgroundColor:'transparent',
    color:'var(--text-dim)',border:'1px solid var(--border)',
    fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.1em',
    transition:'all .15s',
  },
  header: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    marginBottom:'32px',
  },
  heading: {
    fontSize:'12px',fontWeight:500,textTransform:'uppercase',
    letterSpacing:'0.15em',color:'var(--text-dim)',
  },
  newBtn: {
    padding:'8px 18px',backgroundColor:'var(--accent)',
    color:'var(--bg)',border:'none',fontSize:'11px',
    fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',
    transition:'opacity .15s',
  },
  form: {
    display:'flex',gap:'8px',marginBottom:'28px',
    padding:'16px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',
    animation:'slideDown .2s ease',
  },
  input: {
    flex:1,padding:'10px 14px',
    backgroundColor:'var(--bg)',color:'var(--text)',
    border:'1px solid var(--border)',
    outline:'none',fontSize:'12px',
    transition:'border-color .15s',
  },
  submit: {
    padding:'10px 20px',backgroundColor:'var(--accent)',
    color:'var(--bg)',border:'none',fontWeight:600,
    fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.1em',
    whiteSpace:'nowrap',
  },
  list: { display:'flex',flexDirection:'column',gap:'1px' },
  card: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'18px 20px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',
    textDecoration:'none',color:'var(--text)',
    transition:'all .15s',
  },
  cardName: { fontSize:'13px',fontWeight:500,marginBottom:'4px' },
  cardDomain: { fontSize:'11px',color:'var(--text-muted)' },
  arrow: { fontSize:'16px',color:'var(--text-muted)',transition:'all .15s' },
  empty: {
    textAlign:'center',padding:'80px 20px',color:'var(--text-muted)',
    border:'1px dashed var(--border)',
  },
  emptyTitle: { fontSize:'13px',marginBottom:'8px',color:'var(--text-dim)' },
  emptyDesc: { fontSize:'11px',lineHeight:1.8 },
  errorMsg: {
    padding:'10px 16px',marginBottom:'16px',
    backgroundColor:'transparent',color:'var(--danger)',
    border:'1px solid var(--danger)',
    fontSize:'11px',
  },
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div style={S.wrap}>
      <div style={S.topbar}>
        <span style={S.logo}>Plat</span>
        <button
          style={S.logout}
          onClick={clearToken}
          onMouseEnter={e=>{e.target.style.borderColor='var(--text-dim)';e.target.style.color='var(--text)'}}
          onMouseLeave={e=>{e.target.style.borderColor='var(--border)';e.target.style.color='var(--text-dim)'}}
        >Logout</button>
      </div>

      <div style={S.header}>
        <span style={S.heading}>Projects</span>
        <button
          style={S.newBtn}
          onClick={()=>setShowCreate(!showCreate)}
          onMouseEnter={e=>e.target.style.opacity='0.85'}
          onMouseLeave={e=>e.target.style.opacity='1'}
        >+ New</button>
      </div>

      {error && <div style={S.errorMsg}>! {error}</div>}

      {showCreate && (
        <form onSubmit={handleCreate} style={S.form}>
          <input
            type="text" value={repoUrl}
            onChange={e=>setRepoUrl(e.target.value)}
            placeholder="> https://github.com/user/repo.git"
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
            {creating ? '...' : 'Deploy'}
          </button>
        </form>
      )}

      {loading ? (
        <div style={S.empty}>
          <span style={{animation:'pulse 1.5s ease infinite',color:'var(--text-dim)'}}>Loading...</span>
        </div>
      ) : projects.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyTitle}>No projects</div>
          <div style={S.emptyDesc}>
            Create your first project to start deploying.<br/>
            Connect a GitHub repo or use the CLI.
          </div>
        </div>
      ) : (
        <div style={S.list}>
          {projects.map(p=>(
            <Link
              to={`/projects/${p.id}`} key={p.id}
              style={S.card}
              onMouseEnter={e=>{
                e.target.style.borderColor='var(--border-light)';
                e.target.style.backgroundColor='var(--surface2)';
                const arrow = e.target.querySelector('.card-arrow');
                if(arrow) arrow.style.color='var(--text)';
              }}
              onMouseLeave={e=>{
                e.target.style.borderColor='var(--border)';
                e.target.style.backgroundColor='var(--surface)';
                const arrow = e.target.querySelector('.card-arrow');
                if(arrow) arrow.style.color='var(--text-muted)';
              }}
            >
              <div>
                <div style={S.cardName}>{p.repo_name}</div>
                <div style={S.cardDomain}>{p.domain}</div>
              </div>
              <span className="card-arrow" style={S.arrow}>&rarr;</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
