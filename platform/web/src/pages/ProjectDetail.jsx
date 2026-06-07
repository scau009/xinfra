import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useI18n } from '../i18n/context';
import DeployButton from '../components/DeployButton';
import StopButton from '../components/StopButton';
import EnvVarForm from '../components/EnvVarForm';
import DeployLog from './DeployLog';

const STATUS = {
  pending:   { color:'var(--text-muted)', key:'status.pending',   icon:'○' },
  building:  { color:'var(--warn)',      key:'status.building',  icon:'◉' },
  deploying: { color:'var(--warn)',      key:'status.deploying', icon:'◉' },
  running:   { color:'var(--success)',   key:'status.running',   icon:'●' },
  failed:    { color:'var(--danger)',    key:'status.failed',    icon:'✕' },
  stopped:   { color:'var(--text-muted)', key:'status.stopped',   icon:'◼' },
};

const S = {
  wrap: { minHeight:'100vh',maxWidth:'960px',margin:'0 auto',padding:'0 24px' },
  topbar: {
    display:'flex',alignItems:'center',gap:'24px',
    padding:'24px 0',borderBottom:'1px solid var(--border)',
    marginBottom:'40px',
  },
  back: {
    color:'var(--text-dim)',textDecoration:'none',fontSize:'14px',
    transition:'color .15s',padding:'4px 0',
  },
  title: {
    fontSize:'16px',fontWeight:600,letterSpacing:'0.05em',
  },
  section: { marginBottom:'40px' },
  sectionTitle: {
    fontSize:'12px',fontWeight:600,textTransform:'uppercase',
    letterSpacing:'0.2em',color:'var(--text-dim)',
    marginBottom:'16px',
  },
  meta: {
    display:'flex',gap:'36px',flexWrap:'wrap',
    fontSize:'13px',color:'var(--text-dim)',
    marginBottom:'28px',padding:'16px 20px',
    backgroundColor:'var(--surface)',border:'1px solid var(--border)',
  },
  metaItem: { display:'flex',flexDirection:'column',gap:'3px' },
  metaLabel: { fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-muted)' },
  metaLink: { color:'var(--text)',textDecoration:'none',borderBottom:'1px solid var(--border-light)' },
  deployBar: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'18px 22px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',marginBottom:'24px',
  },
  deployMsg: { fontSize:'13px',color:'var(--success)',fontWeight:500 },
  deployErr: { fontSize:'13px',color:'var(--danger)',fontWeight:500 },
  historyList: { display:'flex',flexDirection:'column',gap:'1px' },
  historyRow: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'14px 18px',backgroundColor:'var(--surface)',
    border:'1px solid var(--border)',cursor:'pointer',
    transition:'all .12s',fontSize:'13px',
  },
  historyLeft: { display:'flex',alignItems:'center',gap:'12px' },
  historyRight: { color:'var(--text-dim)',fontSize:'12px',textAlign:'right' },
  historyMeta: { fontSize:'11px',color:'var(--text-muted)',marginTop:'2px' },
  empty: {
    textAlign:'center',padding:'40px 20px',color:'var(--text-muted)',
    border:'1px dashed var(--border)',fontSize:'13px',
    backgroundColor:'var(--surface)',
  },
  loading: { textAlign:'center',padding:'80px 20px',color:'var(--text-muted)',fontSize:'14px' },
  errorPage: { textAlign:'center',padding:'80px 20px',color:'var(--danger)',fontSize:'14px' },
  dangerZone: { marginTop:'48px',padding:'22px',border:'1px solid var(--danger)',backgroundColor:'var(--surface)' },
  dangerTitle: { fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.2em',color:'var(--danger)',marginBottom:'14px' },
  dangerDesc: { fontSize:'13px',color:'var(--text-dim)',marginBottom:'16px',lineHeight:1.7 },
  deleteBtn: { padding:'9px 20px',backgroundColor:'transparent',color:'var(--danger)',border:'1px solid var(--danger)',fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',cursor:'pointer',transition:'all .15s' },
  confirmWrap: { marginTop:'14px',padding:'14px 18px',border:'1px solid var(--danger)',display:'flex',alignItems:'center',gap:'16px',flexWrap:'wrap' },
  confirmText: { fontSize:'13px',color:'var(--danger)',flex:1,minWidth:'200px' },
  confirmBtn: { padding:'8px 18px',backgroundColor:'var(--danger)',color:'var(--bg)',border:'none',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',cursor:'pointer' },
  cancelBtn: { padding:'8px 18px',backgroundColor:'transparent',color:'var(--text-dim)',border:'1px solid var(--border)',fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',cursor:'pointer' },
};

export default function ProjectDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDeployId, setActiveDeployId] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState(null);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState(null);
  const navigate = useNavigate();

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

  async function handleDelete() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await api.deleteProject(id);
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteErr(err.message);
      setDeleting(false);
    }
  }

  async function handleStop() {
    setStopping(true);
    setStopError(null);
    try {
      await api.stopProject(id);
      await load();
    } catch (err) {
      setStopError(err.message);
    } finally {
      setStopping(false);
    }
  }

  if (loading) return <div style={S.wrap}><div style={S.loading}>{t('project.loading')}</div></div>;
  if (error) return <div style={S.wrap}><div style={S.errorPage}>! {error}</div></div>;
  if (!project) return <div style={S.wrap}><div style={S.errorPage}>{t('project.not_found')}</div></div>;

  const hasRunning = project.deploys?.some(
    d => d.status === 'building' || d.status === 'deploying' || d.status === 'pending'
  );
  const isRunning = project.deploys?.some(d => d.status === 'running');

  return (
    <div style={S.wrap}>
      <div style={S.topbar}>
        <Link
          to="/" style={S.back}
          onMouseEnter={e=>e.target.style.color='var(--text)'}
          onMouseLeave={e=>e.target.style.color='var(--text-dim)'}
        >{t('project.back')}</Link>
        <span style={{color:'var(--text-muted)'}}>/</span>
        <span style={S.title}>{project.repo_name}</span>
      </div>

      <div style={S.meta}>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>{t('project.meta_domain')}</span>
          <a href={`https://${project.domain}`} target="_blank" rel="noopener" style={S.metaLink}>
            {project.domain}
          </a>
        </div>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>{t('project.meta_framework')}</span>
          <span>{project.framework || t('project.framework_auto')}</span>
        </div>
        <div style={S.metaItem}>
          <span style={S.metaLabel}>{t('project.meta_source')}</span>
          <span>{project.source_type || 'github'}</span>
        </div>
      </div>

      <div style={S.section}>
        <div style={S.deployBar}>
          <div>
            {deployError && <span style={S.deployErr}>! {deployError}</span>}
            {deploySuccess && !deployError && <span style={S.deployMsg}>{t('project.deploy_queued')}</span>}
            {stopError && <span style={S.deployErr}>! {stopError}</span>}
          </div>
          <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
            {isRunning && <StopButton onStop={handleStop} loading={stopping} />}
            <DeployButton
              onDeploy={handleDeploy}
              loading={deploying}
              hasRunningDeploy={hasRunning}
            />
          </div>
        </div>

        {activeDeployId && (
          <DeployLog deployId={activeDeployId} onComplete={load} />
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>{t('project.history')}</div>
        {(!project.deploys || project.deploys.length === 0) ? (
          <div style={S.empty}>{t('project.history_empty')}</div>
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
                    <span style={{color:s.color,fontSize:'12px'}}>{s.icon}</span>
                    <span style={{color:s.color,textTransform:'uppercase',letterSpacing:'0.1em',fontSize:'13px'}}>
                      {t(s.key)}
                    </span>
                  </div>
                  <div style={S.historyRight}>
                    <div>{d.commit_sha ? d.commit_sha.slice(0,7) : t('project.commit_manual')}</div>
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

      <div style={S.section}>
        <div style={S.sectionTitle}>{t('project.environment')}</div>
        <EnvVarForm projectId={project.id} />
      </div>

      <div style={S.dangerZone}>
        <div style={S.dangerTitle}>{t('project.danger_zone')}</div>
        <div style={S.dangerDesc}>
          {t('project.danger_desc')}
        </div>
        {deleteErr && (
          <div style={{padding:'10px 14px',marginBottom:'12px',color:'var(--danger)',border:'1px solid var(--danger)',fontSize:'12px'}}>
            ! {deleteErr}
          </div>
        )}
        {!showDeleteConfirm ? (
          <button
            style={S.deleteBtn}
            onClick={() => setShowDeleteConfirm(true)}
            onMouseEnter={e => { e.target.style.backgroundColor='var(--danger)'; e.target.style.color='var(--bg)' }}
            onMouseLeave={e => { e.target.style.backgroundColor='transparent'; e.target.style.color='var(--danger)' }}
          >
            {t('project.delete_btn')}
          </button>
        ) : (
          <div style={S.confirmWrap}>
            <span style={S.confirmText}>{t('project.confirm_text')}</span>
            <button
              style={S.confirmBtn}
              disabled={deleting}
              onClick={handleDelete}
              onMouseEnter={e => e.target.style.opacity='0.85'}
              onMouseLeave={e => e.target.style.opacity='1'}
            >
              {deleting ? t('project.deleting') : t('project.confirm_yes')}
            </button>
            <button
              style={S.cancelBtn}
              disabled={deleting}
              onClick={() => setShowDeleteConfirm(false)}
              onMouseEnter={e => { e.target.style.borderColor='var(--text-dim)'; e.target.style.color='var(--text)' }}
              onMouseLeave={e => { e.target.style.borderColor='var(--border)'; e.target.style.color='var(--text-dim)' }}
            >
              {t('project.confirm_cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
