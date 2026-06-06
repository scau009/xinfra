import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setToken, getToken } from '../auth';
import { api } from '../api';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      navigate('/');
      return;
    }
    if (getToken()) {
      navigate('/');
    }
  }, []);

  async function handleLogin() {
    const { url } = await api.getLoginUrl();
    window.location.href = url;
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Plat</h1>
        <p style={styles.subtitle}>Deploy your code in seconds. Zero config.</p>
        <button onClick={handleLogin} style={styles.button}>
          Login with GitHub
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', backgroundColor: '#0a0a0a', color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  },
  card: { textAlign: 'center', maxWidth: '400px' },
  title: { fontSize: '48px', fontWeight: 700, margin: '0 0 8px' },
  subtitle: { color: '#888', fontSize: '18px', marginBottom: '32px' },
  button: {
    padding: '12px 32px', fontSize: '16px', fontWeight: 600,
    backgroundColor: '#fff', color: '#000', border: 'none',
    borderRadius: '8px', cursor: 'pointer',
  },
};
