import { useState } from 'react';
import { setAdminPassword, getAdminPassword } from '../utils/api';
import PasswordGate from './PasswordGate';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
  // Skipped when staff mode already holds the password
  const [password, setPassword] = useState(getAdminPassword);
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = (value) => {
    setAdminPassword(value);
    setPassword(value);
    setPasswordError('');
  };

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      if (err.message === 'Unauthorized') {
        setAdminPassword('');
        setPassword('');
        setPasswordError('Wrong password. Try again.');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
        </div>
        <p className="modal-text" style={{ marginBottom: 20 }}>{message}</p>

        {!password ? (
          <PasswordGate
            prompt="Enter the staff password to confirm."
            error={passwordError}
            onSubmit={handlePasswordSubmit}
            onCancel={onCancel}
          />
        ) : (
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={handleConfirm}>
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
