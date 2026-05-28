import { useState } from 'react';
import { setAdminPassword, getAdminPassword } from '../utils/api';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
  const [password, setPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) return;
    setAdminPassword(passwordInput);
    setPassword(passwordInput);
    setPasswordError('');
  };

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      if (err.message === 'Unauthorized') {
        setAdminPassword('');
        setPassword('');
        setPasswordInput('');
        setPasswordError('Wrong password. Try again.');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
        </div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          color: 'var(--gold)',
          fontSize: '1.4rem',
          textAlign: 'center',
          marginBottom: 12,
        }}>
          {title}
        </h2>
        <p style={{
          color: 'rgba(250,243,224,0.75)',
          fontSize: '0.95rem',
          textAlign: 'center',
          lineHeight: 1.6,
          marginBottom: 28,
        }}>
          {message}
        </p>

        {/* PASSWORD GATE */}
        {!password ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
            <p style={{ color: 'rgba(250,243,224,0.6)', textAlign: 'center', fontSize: '0.9rem' }}>
              🔒 Enter admin password to confirm
            </p>
            <input
              className="input"
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              autoFocus
            />
            {passwordError && (
              <p style={{ color: '#e74c3c', fontSize: '0.8rem', textAlign: 'center' }}>
                {passwordError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={onCancel}>
                Cancel
              </button>
              <button className="btn btn-gold" onClick={handlePasswordSubmit}>
                🔓 Unlock
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button
              className={`btn ${danger ? 'btn-danger' : 'btn-gold'}`}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
