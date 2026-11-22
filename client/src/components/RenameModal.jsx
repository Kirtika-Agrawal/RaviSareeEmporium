import { useState } from 'react';
import { renameProduct, setAdminPassword, getAdminPassword } from '../utils/api';
import { useToast } from '../hooks/useToast';
import PasswordGate from './PasswordGate';

export default function RenameModal({ productId, onClose, onRenamed }) {
  const toast = useToast();
  const [newId, setNewId] = useState(productId);
  const [loading, setLoading] = useState(false);

  // Password gate — skipped when staff mode already holds the password
  const [password, setPassword] = useState(getAdminPassword);
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = (value) => {
    setAdminPassword(value);
    setPassword(value);
    setPasswordError('');
  };

  const handleSubmit = async () => {
    const trimmed = newId.trim().toUpperCase();
    if (!trimmed) return toast('Please enter a design number', 'error');
    if (trimmed === productId) return onClose();
    setLoading(true);
    try {
      const { product_id } = await renameProduct(productId, trimmed);
      toast(`Renamed to ${product_id}`);
      onRenamed(product_id);
      onClose();
    } catch (err) {
      if (err.message === 'Unauthorized') {
        setAdminPassword('');
        setPassword('');
        setPasswordError('Wrong password. Try again.');
      } else {
        toast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h2 className="modal-title">Rename Design</h2>
          <p className="modal-sub">Design {productId}</p>
        </div>

        {!password ? (
          <PasswordGate error={passwordError} onSubmit={handlePasswordSubmit} onCancel={onClose} />
        ) : (
          <div className="modal-form">
            <div>
              <label className="label">New design number *</label>
              <input
                className="input input-id"
                value={newId}
                onChange={e => setNewId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
              <p className="field-hint">
                All colours and photos stay with the design.
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading && <span className="spinner spinner-sm" />}
                {loading ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
