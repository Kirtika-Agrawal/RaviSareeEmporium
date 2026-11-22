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
        <div className="modal-head">
          <h2 className="modal-title">Staff Login</h2>
        </div>
        <div className="modal-form">
          <p className="modal-text">
            Enter the staff password to add, edit, rename or delete designs.
          </p>
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading && <span className="spinner spinner-sm" />}
              {loading ? 'Checking...' : 'Log In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
