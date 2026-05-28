import { useState } from 'react';
import ImageUpload from './ImageUpload';
import { createProduct, setAdminPassword, getAdminPassword } from '../utils/api';
import { useToast } from '../hooks/useToast';

export default function AddProductModal({ onClose, onSuccess }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  // Password gate
  const [password, setPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = () => {
    if (!passwordInput.trim()) return;
    setAdminPassword(passwordInput);
    setPassword(passwordInput);
    setPasswordError('');
  };

  const handleFile = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!productId.trim()) return toast('Please enter a Product ID', 'error');
    if (!file) return toast('Please upload an image', 'error');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('product_id', productId.trim().toUpperCase());
      fd.append('description', description);
      fd.append('image', file);
      const product = await createProduct(fd);
      toast(`Product ${product.product_id} created! 🥻`);
      onSuccess(product);
      onClose();
    } catch (err) {
      // If wrong password, show error and reset password
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          color: 'var(--gold)',
          fontSize: '1.5rem',
          marginBottom: 6,
          textAlign: 'center',
        }}>
          Add New Product
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
          /* ACTUAL FORM — shown only after password */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label">Product ID *</label>
              <input
                className="input"
                placeholder="e.g. RS-001, LH-042"
                value={productId}
                onChange={e => setProductId(e.target.value.toUpperCase())}
                style={{ fontWeight: 700, letterSpacing: '0.1em' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'rgba(250,243,224,0.4)', marginTop: 4 }}>
                RS = Saree, LH = Lehenga (auto-uppercased)
              </p>
            </div>
            <ImageUpload onFileSelect={handleFile} preview={preview} label="First Colour Variant Image *" />
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                placeholder="e.g. Red Banarasi silk with gold zari border..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
              />
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
                {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : '✦'}
                {loading ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
