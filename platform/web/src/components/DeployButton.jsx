import { useI18n } from '../i18n/context';

export default function DeployButton({ onDeploy, loading, hasRunningDeploy }) {
  const { t } = useI18n();
  const disabled = loading || hasRunningDeploy;
  const label = loading ? t('deploy.deploying')
    : hasRunningDeploy ? t('deploy.in_progress')
    : t('deploy.deploy');

  return (
    <button
      onClick={onDeploy}
      disabled={disabled}
      style={{
        display:'inline-flex',alignItems:'center',gap:'10px',
        padding:'12px 30px',fontSize:'14px',fontWeight:600,
        backgroundColor: disabled ? 'transparent' : 'var(--accent)',
        color: disabled ? 'var(--text-dim)' : 'var(--bg)',
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
      display:'inline-block',width:'14px',height:'14px',
      border:'2px solid var(--bg)',
      borderTopColor:'transparent',borderRadius:'50%',
      animation:'spin .6s linear infinite',
    }} />
  );
}
