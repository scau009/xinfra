import { useState, useEffect } from 'react';
import { getToken } from '../auth';
import { useI18n } from '../i18n/context';

const S = {
  item: {
    display:'flex',alignItems:'center',padding:'12px 0',
    borderBottom:'1px solid var(--border)',
    gap:'14px',
  },
  key: { flex:1,fontSize:'13px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' },
  value: {
    fontSize:'12px',color:'var(--text-muted)',
    letterSpacing:'0.2em',marginRight:'10px',
  },
  delBtn: {
    padding:'5px 12px',backgroundColor:'transparent',
    color:'var(--danger)',border:'1px solid transparent',
    fontSize:'11px',cursor:'pointer',textTransform:'uppercase',
    letterSpacing:'0.1em',transition:'all .15s',
  },
  form: {
    display:'flex',gap:'10px',marginTop:'16px',paddingTop:'16px',
    borderTop:'1px solid var(--border)',
  },
  input: {
    padding:'10px 14px',backgroundColor:'var(--bg)',color:'var(--text)',
    border:'1px solid var(--border)',outline:'none',fontSize:'13px',
    transition:'border-color .15s',
  },
  addBtn: {
    padding:'10px 20px',backgroundColor:'var(--accent)',color:'var(--bg)',
    border:'none',fontSize:'13px',fontWeight:600,textTransform:'uppercase',
    letterSpacing:'0.1em',cursor:'pointer',
  },
  empty: {
    padding:'24px 0',color:'var(--text-muted)',fontSize:'13px',
    textAlign:'center',borderBottom:'1px solid var(--border)',
  },
  error: {
    padding:'8px 0',color:'var(--danger)',fontSize:'12px',
  },
};

export default function EnvVarForm({ projectId }) {
  const { t } = useI18n();
  const [vars, setVars] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const token = getToken();
  const headers = {
    'Content-Type':'application/json',
    Authorization:`Bearer ${token}`,
  };

  useEffect(() => {
    fetch(`/api/projects/${projectId}/env`,{headers})
      .then(r=>r.json())
      .then(setVars)
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [projectId]);

  async function addVar(e) {
    e.preventDefault();
    if(!newKey.trim()) return;
    setError(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/env`,{
        method:'POST',headers,
        body:JSON.stringify({key:newKey.trim(),value:newValue}),
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({error:'Failed'}));
        throw new Error(err.error);
      }
      setVars(prev=>{
        const exists = prev.find(v=>v.key===newKey.trim());
        if(exists) return prev.map(v=>v.key===newKey.trim()?{...v}:v);
        return [...prev,{key:newKey.trim()}];
      });
      setNewKey('');
      setNewValue('');
    } catch(err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteVar(key) {
    try {
      await fetch(`/api/projects/${projectId}/env/${encodeURIComponent(key)}`,{
        method:'DELETE',headers,
      });
      setVars(prev=>prev.filter(v=>v.key!==key));
    } catch {}
  }

  return (
    <div>
      {loading ? (
        <div style={S.empty}>{t('env.loading')}</div>
      ) : vars.length === 0 ? (
        <div style={S.empty}>{t('env.empty')}</div>
      ) : (
        vars.map(v=>(
          <div key={v.key} style={S.item}>
            <code style={S.key}>{v.key}</code>
            <span style={S.value}>········</span>
            <button
              style={S.delBtn}
              onClick={()=>deleteVar(v.key)}
              onMouseEnter={e=>e.target.style.borderColor='var(--danger)'}
              onMouseLeave={e=>e.target.style.borderColor='transparent'}
            >{t('env.del_btn')}</button>
          </div>
        ))
      )}

      {error && <div style={S.error}>! {error}</div>}

      <form onSubmit={addVar} style={S.form}>
        <input
          value={newKey} onChange={e=>setNewKey(e.target.value)}
          placeholder={t('env.key_placeholder')} style={{...S.input,width:'150px'}}
          onFocus={e=>e.target.style.borderColor='var(--border-light)'}
          onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
        <input
          value={newValue} onChange={e=>setNewValue(e.target.value)}
          placeholder={t('env.value_placeholder')} style={{...S.input,flex:1}}
          onFocus={e=>e.target.style.borderColor='var(--border-light)'}
          onBlur={e=>e.target.style.borderColor='var(--border)'}
        />
        <button type="submit" disabled={adding} style={{
          ...S.addBtn,
          opacity:adding?0.5:1,
          cursor:adding?'wait':'pointer',
        }}>
          {adding ? t('env.adding') : t('env.add_btn')}
        </button>
      </form>
    </div>
  );
}
