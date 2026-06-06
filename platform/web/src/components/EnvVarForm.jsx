import { useState, useEffect } from 'react';

export default function EnvVarForm({ projectId }) {
  const [vars, setVars] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/env`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('plat_token')}` },
    }).then(r => r.json()).then(setVars).catch(() => {});
  }, [projectId]);

  async function addVar(e) {
    e.preventDefault();
    if (!newKey.trim()) return;
    await fetch(`/api/projects/${projectId}/env`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('plat_token')}`,
      },
      body: JSON.stringify({ key: newKey.trim(), value: newValue }),
    });
    setVars([...vars, { key: newKey.trim() }]);
    setNewKey('');
    setNewValue('');
  }

  async function deleteVar(key) {
    await fetch(`/api/projects/${projectId}/env/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('plat_token')}` },
    });
    setVars(vars.filter(v => v.key !== key));
  }

  return (
    <div>
      {vars.map((v) => (
        <div key={v.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
          <code style={{ flex: 1 }}>{v.key}</code>
          <span style={{ color: '#666', marginRight: '12px' }}>&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
          <button onClick={() => deleteVar(v.key)} style={{ color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
        </div>
      ))}
      <form onSubmit={addVar} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="KEY" style={inputStyle} />
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="VALUE" style={{ ...inputStyle, flex: 2 }} />
        <button type="submit" style={addBtnStyle}>Add</button>
      </form>
    </div>
  );
}

const inputStyle = {
  padding: '8px 12px', backgroundColor: '#1a1a1a', color: '#fff',
  border: '1px solid #333', borderRadius: '6px', fontSize: '13px',
};
const addBtnStyle = {
  padding: '8px 16px', backgroundColor: '#fff', color: '#000',
  border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer',
};
