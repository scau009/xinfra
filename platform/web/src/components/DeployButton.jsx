export default function DeployButton({ onDeploy, hasRunningDeploy }) {
  return (
    <button
      onClick={onDeploy}
      disabled={hasRunningDeploy}
      style={{
        padding: '10px 24px', fontSize: '15px', fontWeight: 600,
        backgroundColor: hasRunningDeploy ? '#333' : '#fff',
        color: hasRunningDeploy ? '#888' : '#000',
        border: 'none', borderRadius: '8px', cursor: hasRunningDeploy ? 'not-allowed' : 'pointer',
      }}
    >
      {hasRunningDeploy ? 'Deploying...' : 'Deploy'}
    </button>
  );
}
