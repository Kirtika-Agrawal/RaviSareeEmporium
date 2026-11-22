import { useState } from 'react';
import ImageUpload from './ImageUpload';
import PasswordGate from './PasswordGate';
import CategoryField from './CategoryField';
import { createProduct, setAdminPassword, getAdminPassword } from '../utils/api';
import { useToast } from '../hooks/useToast';

export default function AddProductModal({ defaultCategory, onClose, onSuccess }) {
  const toast = useToast();
  const [productId, setProductId] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory || '');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  // Password gate — skipped when staff mode already holds the password
  const [password, setPassword] = useState(getAdminPassword);
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = (value) => {
    setAdminPassword(value);
    setPassword(value);
    setPasswordError('');
  };

  const handleFile = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!productId.trim()) return toast('Please enter a design number', 'error');
    if (!file) return toast('Please add a photo', 'error');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('product_id', productId.trim().toUpperCase());
      fd.append('description', description);
      fd.append('category', category);
      fd.append('image', file);
      const product = await createProduct(fd);
      toast(`Design ${product.product_id} created`);
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
        <div className="modal-head">
          <h2 className="modal-title">New Design</h2>
        </div>

        {!password ? (
          <PasswordGate error={passwordError} onSubmit={handlePasswordSubmit} onCancel={onClose} />
        ) : (
          <div className="modal-form">
            <div>
              <label className="label">Design number *</label>
              <input
                className="input input-id"
                placeholder="e.g. 4356, RS-001"
                value={productId}
                onChange={e => setProductId(e.target.value.toUpperCase())}
              />
            </div>
            <CategoryField value={category} onChange={setCategory} />
            <ImageUpload onFileSelect={handleFile} preview={preview} label="Photo of the first colour *" />
            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                placeholder="e.g. Red Banarasi silk with gold zari border"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading && <span className="spinner spinner-sm" />}
                {loading ? 'Creating...' : 'Create Design'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
