import { useState } from 'react';
import { checkAdminPassword } from '../utils/api';
import { useAdmin } from '../hooks/useAdmin';
import { useToast } from '../hooks/useToast';

export default function StaffLoginModal({ onClose }) {
  const { login } = useAdmin();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (await checkAdminPassword(password)) {
        login(password);
        toast('Staff mode on');
        onClose();
      } else {
        setError('Wrong password. Try again.');
      }
    } catch {
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          color: 'var(--gold)',
          fontSize: '1.5rem',
          marginBottom: 6,
          textAlign: 'center',
        }}>
          Staff Login
        </h2>
        <div className="ornament" style={{ marginBottom: 20 }}>❧ ✦ ❧</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: 'rgba(250,243,224,0.6)', textAlign: 'center', fontSize: '0.9rem' }}>
            🔒 Enter the admin password to add, edit, rename or delete designs
          </p>
          <input
            className="input"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          {error && (
            <p style={{ color: '#e74c3c', fontSize: '0.8rem', textAlign: 'center' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button className="btn btn-gold" onClick={handleSubmit} disabled={loading} style={{ flex: 2 }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : '🔓'}
              {loading ? 'Checking...' : 'Log In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
