import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import DeployButton from '../components/DeployButton';
import EnvVarForm from '../components/EnvVarForm';
import DeployLog from './DeployLog';

const STATUS = {
  pending:   { color:'var(--text-muted)',label:'pending',  icon:'○' },
  building:  { color:'var(--warn)',     label:'building', icon:'◉' },
  deploying: { color:'var(--warn)',     label:'deploying',icon:'◉' },
  running:   { color:'var(--success)',  label:'running',  icon:'●' },
  failed:    { color:'var(--danger)',   label:'failed',   icon:'✕' },
};

const S = {
  wrap: { minHeight:'100vh',maxWidth:'900px',margin:'0 auto',padding:'0 24px' },
  topbar: {
    display:'flex',alignItems:'center',gap:'20px',
    padding:'20px 0',borderBottom:'1px solid var(--border)',
    marginBottom:'36px',
  },
  back: {
    color:'var(--text-dim)',textDecoration:'none',fontSize:'12px',
    transition:'color .15s',padding:'4px 0',
  },
  title: {
    fontSize:'13px',fontWeight:600,letterSpacing:'0.05em',
  },
  section: { marginBottom:'36px' },
  sectionTitle: {
    fontSize:'10px',fontWeight:600,textTransform:'uppercase',
    letterSpacing:'0.2em',color:'var(--text-muted)',
    marginBottom:'14px',
  },
  meta: {
    display:'flex',gap:'32px',flexWrap:'wrap',
    fontSize:'11px',color:'var(--text-dim)',
    marginBottom:'24px',padding:'14px 18px',
    backgroundColor:'var(--surface)',border:'1px solid var(--border)',
  },
  metaItem: { display:'flex',flexDirection:'column',gap:'2px' },
  metaLabel: { fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-muted)' },
  metaLink: { color:'var(--text)',textDecoration:'none',borderBottom:'1px solid var(--border-light)' },
  deployBar: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'16px 20px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',marginBottom:'20px',
  },
  deployMsg: { fontSize:'11px',color:'var(--success)',fontWeight:500 },
  deployErr: { fontSize:'11px',color:'var(--danger)',fontWeight:500 },
  historyList: { display:'flex',flexDirection:'column',gap:'1px' },
  historyRow: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'12px 16px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',cursor:'pointer',
    transition:'all .12s',fontSize:'11px',
  },
  historyLeft: { display:'flex',alignItems:'center',gap:'10px' },
  historyRight: { color:'var(--text-muted)',fontSize:'11px',textAlign:'right' },
  historyMeta: { fontSize:'10px',color:'var(--text-muted)',marginTop:'2px' },
  empty: {
    textAlign:'center',padding:'32px 20px',color:'var(--text-muted)',
    border:'1px dashed var(--border)',fontSize:'11px',
    backgroundColor:'var(--surface)',
  },
  loading: { textAlign:'center',padding:'60px 20px',color:'var(--text-muted)' },
  errorPage: { textAlign:'center',padding:'60px 20px',color:'var(--danger)' },
};

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDeployId, setActiveDeployId] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState(null);
  const [deploySuccess, setDeploySuccess] = useState(false);

  async function load() {
    try {
      const data = await api.getProject(id);
      setProject(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleDeploy() {
    setDeploying(true);
    setDeployError(null);
    setDeploySuccess(false);
    try {
      const deploy = await api.deployProject(id);
      setActiveDeployId(deploy.id);
      setDeploySuccess(true);
      await load();
    } catch (err) {
      setDeployError(err.message);
    } finally {
      setDeploying(false);
    }
  }

  if (loading) return <div style={S.wrap}><div style={S.loading}>Loading...</div></div>;
  if (error) return <div style={S.wrap}><div style={S.errorPage}>! {error}</div></div>;
  if (!project) return <div style={S.wrap}><div style={S.errorPage}>Project not found</div></div>;

  const hasRunning = project.deploys?.some(
    d => d.status === 'building' || d.status === 'deploying' || d.status === 'pending'
  );

  return (
    <div style={S.wrap}>
      <div style={S.topbar}>
        <Link
          to="/" style={S.back}
          onMouseEnter={e=>e.target.style.color='var(--text)'}
          onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
        >&larr; Back</Link>
        <span style={{color:'var(--text-muted)'}}>/</span>
        <span style={S.title}>{project.repo_name}</span>
      </div>

      {/* Meta info */}
      <div style={S.meta}>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>Domain</span>
          <a href={`https://${project.domain}`} target="_blank" rel="noopener" style={S.metaLink}>
            {project.domain}
          </a>
        </div>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>Framework</span>
          <span>{project.framework || 'auto'}</span>
        </div>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>Source</span>
          <span>{project.source_type || 'github'}</span>
        </div>
      </div>

      {/* Deploy bar */}
      <div style={S.section}>
        <div style={S.deployBar}>
          <div>
            {deployError && <span style={S.deployErr}>! {deployError}</span>}
            {deploySuccess && !deployError && <span style={S.deployMsg}>Deploy queued</span>}
          </div>
          <DeployButton
            onDeploy={handleDeploy}
            loading={deploying}
            hasRunningDeploy={hasRunning}
          />
        </div>

        {activeDeployId && (
          <DeployLog deployId={activeDeployId} onComplete={load} />
        )}
      </div>

      {/* Deploy history */}
      <div style={S.section}>
        <div style={S.sectionTitle}>History</div>
        {(!project.deploys || project.deploys.length === 0) ? (
          <div style={S.empty}>No deploy history yet. Click Deploy above to start.</div>
        ) : (
          <div style={S.historyList}>
            {project.deploys.map(d => {
              const s = STATUS[d.status] || STATUS.pending;
              return (
                <div
                  key={d.id}
                  style={S.historyRow}
                  onClick={() => setActiveDeployId(d.id)}
                  onMouseEnter={e=>{
                    e.target.style.borderColor='var(--border-light)';
                    e.target.style.backgroundColor='var(--surface2)';
                  }}
                  onMouseLeave={e=>{
                    e.target.style.borderColor='var(--border)';
                    e.target.style.backgroundColor='var(--surface)';
                  }}
                >
                  <div style={S.historyLeft}>
                    <span style={{color:s.color,fontSize:'10px'}}>{s.icon}</span>
                    <span style={{color:s.color,textTransform:'uppercase',letterSpacing:'0.1em'}}>
                      {s.label}
                    </span>
                  </div>
                  <div style={S.historyRight}>
                    <div>{d.commit_sha ? d.commit_sha.slice(0,7) : 'manual'}</div>
                    <div style={S.historyMeta}>
                      {new Date(d.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Environment variables */}
      <div style={S.section}>
        <div style={S.sectionTitle}>Environment</div>
        <EnvVarForm projectId={project.id} />
      </div>
    </div>
  );
}
