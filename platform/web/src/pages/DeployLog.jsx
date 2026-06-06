import { useEffect, useRef, useState } from 'react';
import { getToken } from '../auth';

export default function DeployLog({ deployId, onComplete }) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const token = getToken();

    async function fetchLogs() {
      const res = await fetch(`/api/deploys/${deployId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === 'log') {
              setLines((prev) => [...prev, data.line]);
            } else if (data.type === 'done') {
              setStatus(data.status);
            }
          } catch {}
        }
      }
    }

    fetchLogs().catch(console.error);
  }, [deployId]);

  useEffect(() => {
    if (status && onComplete) onComplete();
  }, [status]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div style={{
      backgroundColor: '#0d1117', color: '#c9d1d9', fontFamily: 'monospace', fontSize: '13px',
      padding: '16px', borderRadius: '8px', maxHeight: '320px', overflow: 'auto', marginTop: '16px',
    }} ref={containerRef}>
      {lines.map((line, i) => (
        <div key={i} style={{ lineHeight: '1.6' }}>{line}</div>
      ))}
      {status && (
        <div style={{
          marginTop: '12px', padding: '8px', borderRadius: '4px',
          backgroundColor: status === 'running' ? '#052e16' : '#450a0a',
          color: status === 'running' ? '#4ade80' : '#f87171',
        }}>
          {status === 'running' ? '✅ Deploy successful!' : '❌ Deploy failed'}
        </div>
      )}
    </div>
  );
}
