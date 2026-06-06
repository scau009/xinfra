import { useEffect, useRef, useState } from 'react';
import { getToken } from '../auth';

const S = {
  wrap: {
    backgroundColor:'var(--bg)',
    border:'1px solid var(--border)',
    marginTop:'24px',
    overflow:'hidden',
  },
  header: {
    display:'flex',justifyContent:'space-between',alignItems:'center',
    padding:'10px 18px',
    backgroundColor:'var(--surface)',
    borderBottom:'1px solid var(--border)',
    fontSize:'12px',color:'var(--text-dim)',
    textTransform:'uppercase',letterSpacing:'0.1em',
  },
  dots: { display:'flex',gap:'6px' },
  dot: (color) => ({
    width:'10px',height:'10px',borderRadius:'50%',
    backgroundColor:color,
  }),
  body: {
    padding:'18px',maxHeight:'380px',overflow:'auto',
    fontFamily:'var(--font)',fontSize:'13px',
    lineHeight:1.7,color:'var(--text)',
  },
  line: {
    padding:'2px 0',whiteSpace:'pre-wrap',wordBreak:'break-all',
  },
  prompt: { color:'var(--text-muted)',marginRight:'10px',userSelect:'none' },
  banner: (status) => ({
    marginTop:'14px',padding:'12px 16px',
    borderLeft:`4px solid ${status==='running'?'var(--success)':'var(--danger)'}`,
    fontSize:'13px',fontWeight:500,
    color:status==='running'?'var(--success)':'var(--danger)',
    backgroundColor:'var(--surface)',
  }),
  empty: {
    textAlign:'center',padding:'48px 20px',color:'var(--text-muted)',
    fontSize:'13px',
  },
  connecting: {
    textAlign:'center',padding:'24px 20px',color:'var(--text-muted)',
    fontSize:'13px',animation:'pulse 1.5s ease infinite',
  },
};

export default function DeployLog({ deployId, onComplete }) {
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!deployId) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const token = getToken();

    async function stream() {
      try {
        const res = await fetch(`/api/deploys/${deployId}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        setConnected(true);
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
                setLines(prev => [...prev, data.line]);
              } else if (data.type === 'done') {
                setStatus(data.status);
              }
            } catch {}
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Log stream error:', err);
          setStatus('error');
        }
      }
    }

    stream();

    return () => {
      controller.abort();
    };
  }, [deployId]);

  useEffect(() => {
    if (status && onComplete) onComplete();
  }, [status]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  if (!deployId) return null;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span>Deploy Log</span>
        <div style={S.dots}>
          <span style={S.dot('#ff5f57')} />
          <span style={S.dot('#febc2e')} />
          <span style={S.dot('#28c840')} />
        </div>
      </div>

      <div style={S.body} ref={containerRef}>
        {!connected && !status && (
          <div style={S.connecting}>Connecting to build stream...</div>
        )}

        {lines.length === 0 && connected && !status && (
          <div style={S.empty}>Waiting for build output...</div>
        )}

        {lines.map((line, i) => (
          <div key={i} style={S.line}>
            <span style={S.prompt}>$</span>{line}
          </div>
        ))}

        {status && status !== 'error' && (
          <div style={S.banner(status)}>
            {status === 'running' ? '✓ Deploy successful' : '✗ Deploy failed'}
          </div>
        )}

        {status === 'error' && (
          <div style={S.banner('failed')}>✗ Stream disconnected</div>
        )}
      </div>
    </div>
  );
}
