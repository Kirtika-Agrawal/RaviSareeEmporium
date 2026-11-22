import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { fetchProducts, deleteProduct, getImageUrl } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAdmin } from '../hooks/useAdmin';
import AddProductModal from '../components/AddProductModal';
import ConfirmModal from '../components/ConfirmModal';
import StaffLoginModal from '../components/StaffLoginModal';
import { WhatsAppFab } from '../components/WhatsApp';
import { hasWhatsApp, generalEnquiry } from '../utils/whatsapp';

// Outlives HomePage while a product is open, so going back shows the same
// list, search and scroll position immediately while a fresh copy loads.
const homeCache = { products: null, search: '', scrollY: 0 };

export default function HomePage({ onSelectProduct }) {
  const toast = useToast();
  const { isAdmin, logout } = useAdmin();
  const [showLogin, setShowLogin] = useState(false);
  const [products, setProducts] = useState(homeCache.products ?? []);
  const [loading, setLoading] = useState(!homeCache.products);
  const [search, setSearch] = useState(homeCache.search);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [imgErrors, setImgErrors] = useState({});

  useLayoutEffect(() => {
    if (homeCache.products) window.scrollTo(0, homeCache.scrollY);
  }, []);

  const openProduct = (productId) => {
    homeCache.scrollY = window.scrollY;
    onSelectProduct(productId);
  };

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const data = await fetchProducts(q);
      setProducts(data);
      homeCache.products = data;
      homeCache.search = q;
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Handles both the initial load and search. Debounce only while typing, so
  // the first paint isn't held back by 300ms.
  useEffect(() => {
    const t = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleProductAdded = (product) => {
    load(search);
  };

  const handleDelete = async () => {
    try {
      await deleteProduct(deleteTarget.product_id);
      toast(`Product ${deleteTarget.product_id} deleted`);
      setDeleteTarget(null);
      load(search);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <header className="page-header" style={{ padding: '22px 16px 16px', textAlign: 'center' }}>
        <h1 className="brand-title">Ravi Saree Emporium</h1>
        <p className="brand-sub">{isAdmin ? 'Catalogue manager' : 'Saree collection'}</p>

        <div className="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            className="search-input"
            placeholder="Search by design number"
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
          />
        </div>
      </header>

      <div className="page-body">
        <div className="toolbar">
          <span className="muted">
            {products.length} {products.length === 1 ? 'design' : 'designs'}
            {search && ` matching "${search}"`}
          </span>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { logout(); toast('Staff mode off'); }}
                title="Hide staff controls"
              >
                Exit Staff
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                + New Product
              </button>
            </div>
          )}
        </div>

        {/* Loading — keep showing the current list while it refreshes */}
        {loading && products.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="empty-state fade-in">
            <span className="emoji">🥻</span>
            <h3>{search ? 'No designs found' : 'No designs yet'}</h3>
            <p>{search
              ? `No design number matches "${search}"`
              : isAdmin ? 'Add your first product to get started!' : 'New designs are coming soon.'
            }</p>
            {!search && isAdmin && (
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: 20 }}>
                + Add First Product
              </button>
            )}
          </div>
        )}

        {products.length > 0 && (
          <div className="products-grid">
            {products.map((p, i) => (
              <div
                key={p.product_id}
                className="card fade-in"
                style={{ animationDelay: `${Math.min(i, 12) * 0.05}s` }}
                onClick={() => openProduct(p.product_id)}
              >
                <div className="card-photo">
                  {p.first_image && !imgErrors[p.product_id] ? (
                    <img
                      src={getImageUrl(p.first_image)}
                      alt={`Design ${p.product_id}`}
                      loading="lazy"
                      decoding="async"
                      onError={() => setImgErrors(prev => ({ ...prev, [p.product_id]: true }))}
                    />
                  ) : (
                    <div className="fallback">🥻</div>
                  )}
                  {isAdmin && (
                    <button
                      className="photo-action"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                      title="Delete product"
                    >
                      🗑
                    </button>
                  )}
                </div>
                <h3 className="card-title">{p.product_id}</h3>
                <p className="card-meta">
                  {p.variant_count} colour{p.variant_count !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {!isAdmin && (
          <button className="staff-link" onClick={() => setShowLogin(true)}>
            Staff login
          </button>
        )}
      </div>

      {hasWhatsApp && <WhatsAppFab message={generalEnquiry} />}

      {showLogin && <StaffLoginModal onClose={() => setShowLogin(false)} />}

      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleProductAdded}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Product?"
          message={`This will permanently delete "${deleteTarget.product_id}" and all its ${deleteTarget.variant_count} colour variant(s). This cannot be undone.`}
          confirmLabel="Delete Product"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
