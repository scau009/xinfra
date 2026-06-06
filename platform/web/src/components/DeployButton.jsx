export default function DeployButton({ onDeploy, loading, hasRunningDeploy }) {
  const disabled = loading || hasRunningDeploy;
  const label = loading ? 'Deploying...'
    : hasRunningDeploy ? 'In progress'
    : 'Deploy';

  return (
    <button
      onClick={onDeploy}
      disabled={disabled}
      style={{
        display:'inline-flex',alignItems:'center',gap:'10px',
        padding:'10px 28px',fontSize:'12px',fontWeight:600,
        backgroundColor: disabled ? 'transparent' : 'var(--accent)',
        color: disabled ? 'var(--text-muted)' : 'var(--bg)',
        border: disabled ? '1px solid var(--border)' : '1px solid var(--accent)',
        textTransform:'uppercase',letterSpacing:'0.15em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition:'all .15s',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => {
        if (!disabled) { e.target.style.opacity='0.85'; }
      }}
      onMouseLeave={e => {
        if (!disabled) { e.target.style.opacity='1'; }
      }}
    >
      {loading && <Spinner />}
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <span style={{
      display:'inline-block',width:'12px',height:'12px',
      border:'2px solid var(--bg)',
      borderTopColor:'transparent',borderRadius:'50%',
      animation:'spin .6s linear infinite',
    }} />
  );
}
