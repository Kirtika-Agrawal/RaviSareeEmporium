import { useState } from 'react';
import { renameProduct, setAdminPassword, getAdminPassword } from '../utils/api';
import { useToast } from '../hooks/useToast';

export default function RenameModal({ productId, onClose, onRenamed }) {
  const toast = useToast();
  const [newId, setNewId] = useState(productId);
  const [loading, setLoading] = useState(false);

  // Password gate — skipped when staff mode already holds the password
  const [password, setPassword] = useState(getAdminPassword);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) return;
    setAdminPassword(passwordInput);
    setPassword(passwordInput);
    setPasswordError('');
  };

  const handleSubmit = async () => {
    const trimmed = newId.trim().toUpperCase();
    if (!trimmed) return toast('Please enter a Product ID', 'error');
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
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          color: 'var(--gold)',
          fontSize: '1.5rem',
          marginBottom: 6,
          textAlign: 'center',
        }}>
          Rename Product
        </h2>
        <div className="ornament" style={{ marginBottom: 20 }}>❧ ✦ ❧</div>

        {/* PASSWORD GATE */}
        {!password ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'rgba(250,243,224,0.6)', textAlign: 'center', fontSize: '0.9rem' }}>
              🔒 Enter admin password to continue
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
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-gold" onClick={handlePasswordSubmit} style={{ flex: 2 }}>
                🔓 Unlock
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label">New Product ID *</label>
              <input
                className="input"
                value={newId}
                onChange={e => setNewId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ fontWeight: 700, letterSpacing: '0.1em' }}
                autoFocus
              />
              <p style={{ fontSize: '0.75rem', color: 'rgba(250,243,224,0.4)', marginTop: 4 }}>
                Currently {productId}. All colour variants and photos stay with the product.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
              <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn btn-gold"
                onClick={handleSubmit}
                disabled={loading}
                style={{ flex: 2 }}
              >
                {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : '✏'}
                {loading ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
