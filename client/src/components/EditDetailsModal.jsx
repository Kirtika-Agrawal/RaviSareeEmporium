import { useState } from 'react';
import { updateProduct, setAdminPassword, getAdminPassword } from '../utils/api';
import { normalizeCategory, forgetCategoryCounts } from '../utils/categories';
import { useToast } from '../hooks/useToast';
import PasswordGate from './PasswordGate';
import CategoryField from './CategoryField';

export default function EditDetailsModal({ productId, category, onClose, onSaved }) {
  const toast = useToast();
  const [newId, setNewId] = useState(productId);
  const [newCategory, setNewCategory] = useState(category || '');
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
    const trimmedId = newId.trim().toUpperCase();
    if (!trimmedId) return toast('Please enter a design number', 'error');
    const categoryChanged = normalizeCategory(newCategory) !== normalizeCategory(category);
    if (trimmedId === productId && !categoryChanged) return onClose();

    setLoading(true);
    try {
      const changes = { new_product_id: trimmedId };
      if (categoryChanged) changes.category = newCategory;
      const { product_id } = await updateProduct(productId, changes);
      if (categoryChanged) forgetCategoryCounts();
      toast('Design updated');
      onSaved(product_id);
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-head">
          <h2 className="modal-title">Edit Details</h2>
          <p className="modal-sub">Design {productId}</p>
        </div>

        {!password ? (
          <PasswordGate error={passwordError} onSubmit={handlePasswordSubmit} onCancel={onClose} />
        ) : (
          <div className="modal-form">
            <div>
              <label className="label">Design number *</label>
              <input
                className="input input-id"
                value={newId}
                onChange={e => setNewId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <p className="field-hint">
                All colours and photos stay with the design. Links shared with the old number will stop working.
              </p>
            </div>
            <CategoryField value={newCategory} onChange={setNewCategory} />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading && <span className="spinner spinner-sm" />}
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
