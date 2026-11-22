import { useState } from 'react';
import { setCategoryForProducts } from '../utils/api';
import { normalizeCategory, forgetCategoryCounts } from '../utils/categories';
import { useAdmin } from '../hooks/useAdmin';
import { useToast } from '../hooks/useToast';
import CategoryField from './CategoryField';

export default function BulkCategoryModal({ productIds, onClose, onDone }) {
  const toast = useToast();
  const { logout } = useAdmin();
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const count = productIds.length;
  const designs = `${count} design${count === 1 ? '' : 's'}`;
  const name = normalizeCategory(category);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { updated } = await setCategoryForProducts(productIds, category);
      forgetCategoryCounts();
      const changed = `${updated} design${updated === 1 ? '' : 's'}`;
      toast(name ? `${changed} set to ${name}` : `Category removed from ${changed}`);
      onDone();
    } catch (err) {
      if (err.message === 'Unauthorized') {
        logout();
        toast('Staff login expired. Please log in again.', 'error');
        onClose();
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
          <h2 className="modal-title">Set Category</h2>
          <p className="modal-sub">{designs} selected</p>
        </div>
        <div className="modal-form">
          <CategoryField value={category} onChange={setCategory} />
          {!name && <p className="field-hint" style={{ marginTop: -8 }}>Leave empty to remove the category from these designs.</p>}
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading && <span className="spinner spinner-sm" />}
              {loading ? 'Saving...' : name ? `Apply to ${designs}` : `Remove from ${designs}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
