import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { clearToken } from '../auth';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');

  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const url = new URL(repoUrl);
    const repoName = url.pathname.split('/').pop()?.replace('.git', '') || 'unnamed';
    const project = await api.createProject({ repoUrl, repoName, sourceType: 'github' });
    await api.deployProject(project.id);
    setProjects([project, ...projects]);
    setShowCreate(false);
    setRepoUrl('');
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Plat</h1>
        <button onClick={clearToken} style={styles.logoutBtn}>Logout</button>
      </header>

      <div style={styles.content}>
        <div style={styles.topBar}>
          <h2>Projects</h2>
          <button onClick={() => setShowCreate(!showCreate)} style={styles.addBtn}>
            + New Project
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} style={styles.createForm}>
            <input
              type="text" value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              style={styles.input}
            />
            <button type="submit" style={styles.createBtn}>Create & Deploy</button>
          </form>
        )}

        {loading ? <p>Loading...</p> : projects.length === 0 ? (
          <p style={styles.empty}>No projects yet. Create your first one.</p>
        ) : (
          <div>
            {projects.map((p) => (
              <Link to={`/projects/${p.id}`} key={p.id} style={styles.projectCard}>
                <div>
                  <strong>{p.repo_name}</strong>
                  <span style={styles.domain}>{p.domain}</span>
                </div>
                <span style={styles.arrow}>&rarr;</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'system-ui' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #222' },
  logoutBtn: { padding: '6px 16px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  content: { maxWidth: '720px', margin: '0 auto', padding: '32px 16px' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  addBtn: { padding: '8px 20px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' },
  createForm: { display: 'flex', gap: '8px', marginBottom: '24px' },
  input: { flex: 1, padding: '10px 16px', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '8px', fontSize: '14px' },
  createBtn: { padding: '10px 20px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  empty: { color: '#666', textAlign: 'center', marginTop: '64px' },
  projectCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', marginBottom: '8px', textDecoration: 'none', color: '#fff' },
  domain: { display: 'block', color: '#666', fontSize: '13px', marginTop: '4px' },
  arrow: { fontSize: '20px', color: '#666' },
};
