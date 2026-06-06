import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import DeployButton from '../components/DeployButton';
import EnvVarForm from '../components/EnvVarForm';
import DeployLog from './DeployLog';

const STATUS_COLORS = {
  pending: '#888',
  building: '#f0a500',
  deploying: '#f0a500',
  running: '#00c853',
  failed: '#ff1744',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDeployId, setActiveDeployId] = useState(null);

  async function load() {
    try {
      const data = await api.getProject(id);
      setProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleDeploy() {
    const deploy = await api.deployProject(id);
    setActiveDeployId(deploy.id);
    await load();
  }

  if (loading) return <div style={styles.container}><p>Loading...</p></div>;
  if (error) return <div style={styles.container}><p style={{color:'red'}}>{error}</p></div>;
  if (!project) return <div style={styles.container}><p>Project not found</p></div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.back}>&larr; Back</Link>
        <h1>{project.repo_name}</h1>
      </header>

      <div style={styles.content}>
        <div style={styles.meta}>
          <span>Domain: <a href={`https://${project.domain}`} target="_blank" rel="noopener" style={{color: '#4da6ff'}}>{project.domain}</a></span>
          <span>Framework: {project.framework || 'auto-detect'}</span>
        </div>

        <DeployButton onDeploy={handleDeploy} hasRunningDeploy={project.deploys?.some(d => d.status === 'building' || d.status === 'deploying')} />

        {activeDeployId && (
          <DeployLog deployId={activeDeployId} onComplete={load} />
        )}

        <h2 style={{ marginTop: '32px' }}>Deploy History</h2>
        {(!project.deploys || project.deploys.length === 0) ? (
          <p style={styles.empty}>No deploys yet</p>
        ) : (
          <div>
            {project.deploys.map((d) => (
              <div key={d.id} style={styles.deployRow} onClick={() => setActiveDeployId(d.id)}>
                <div>
                  <span style={{ ...styles.statusDot, backgroundColor: STATUS_COLORS[d.status] || '#888' }} />
                  <strong style={{ marginLeft: '8px' }}>{d.status}</strong>
                </div>
                <div style={styles.deployMeta}>
                  {d.commit_sha ? d.commit_sha.slice(0, 7) : 'manual'}
                  <span style={{ marginLeft: '12px', color: '#666' }}>
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ marginTop: '32px' }}>Environment Variables</h2>
        <EnvVarForm projectId={project.id} />
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'system-ui' },
  header: { padding: '16px 32px', borderBottom: '1px solid #222' },
  back: { color: '#888', textDecoration: 'none', fontSize: '14px' },
  content: { maxWidth: '720px', margin: '0 auto', padding: '32px 16px' },
  meta: { display: 'flex', gap: '24px', color: '#888', fontSize: '14px', marginBottom: '24px' },
  empty: { color: '#666', textAlign: 'center', marginTop: '32px' },
  deployRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' },
  statusDot: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%' },
  deployMeta: { color: '#888', fontSize: '13px' },
};
