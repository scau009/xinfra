export default function StopButton({ onStop, loading }) {
  return (
    <button
      onClick={onStop}
      disabled={loading}
      style={{
        display:'inline-flex',alignItems:'center',gap:'10px',
        padding:'12px 30px',fontSize:'14px',fontWeight:600,
        backgroundColor: loading ? 'transparent' : 'var(--warn)',
        color: loading ? 'var(--text-dim)' : 'var(--bg)',
        border: loading ? '1px solid var(--border)' : '1px solid var(--warn)',
        textTransform:'uppercase',letterSpacing:'0.15em',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition:'all .15s',
        opacity: loading ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!loading) { e.target.style.opacity='0.85'; }
      }}
      onMouseLeave={e => {
        if (!loading) { e.target.style.opacity='1'; }
      }}
    >
      {loading ? '...' : 'Stop'}
    </button>
  );
}
