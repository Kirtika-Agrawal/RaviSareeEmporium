import { useState, useEffect, useCallback } from 'react';
import { fetchProducts, deleteProduct, getImageUrl } from '../utils/api';
import { useToast } from '../hooks/useToast';
import AddProductModal from '../components/AddProductModal';
import ConfirmModal from '../components/ConfirmModal';

export default function HomePage({ onSelectProduct }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [imgErrors, setImgErrors] = useState({});

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const data = await fetchProducts(q);
      setProducts(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
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
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(61, 13, 24, 0.98) 0%, rgba(90, 18, 32, 0.95) 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.3)',
        padding: '28px 20px 20px',
        textAlign: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <div className="ornament" style={{ fontSize: '0.75rem', letterSpacing: '0.8em', marginBottom: 6 }}>
          ✦ ✦ ✦
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(1.4rem, 5vw, 2.2rem)',
          color: 'var(--gold)',
          letterSpacing: '0.04em',
          textShadow: '0 2px 12px rgba(201,168,76,0.4)',
          lineHeight: 1.2,
          marginBottom: 2,
        }}>
          Ravi Saree Emporium
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          color: 'rgba(201,168,76,0.6)',
          fontSize: '0.85rem',
          letterSpacing: '0.15em',
          marginBottom: 16,
        }}>
          Product Catalogue Manager
        </p>

        {/* Search */}
        <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(201,168,76,0.5)', fontSize: '1rem',
          }}>🔍</span>
          <input
            className="input"
            style={{ paddingLeft: 42, fontSize: '1rem' }}
            placeholder="Search by Product ID..."
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
          />
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Stats bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <div>
            <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>
              {products.length} {products.length === 1 ? 'Product' : 'Products'}
            </span>
            {search && (
              <span style={{ color: 'rgba(250,243,224,0.4)', fontSize: '0.8rem', marginLeft: 8 }}>
                matching "{search}"
              </span>
            )}
          </div>
          <button
            className="btn btn-gold"
            onClick={() => setShowAddModal(true)}
            style={{ padding: '10px 18px' }}
          >
            <span style={{ fontSize: '1.1rem' }}>+</span> New Product
          </button>
        </div>

        <div className="ornamental-divider">
          <span>❖ Catalogue ❖</span>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {/* Empty */}
        {!loading && products.length === 0 && (
          <div className="empty-state fade-in">
            <span className="emoji">🥻</span>
            <h3>{search ? 'No products found' : 'No products yet'}</h3>
            <p>{search
              ? `No product ID matches "${search}"`
              : 'Add your first product to get started!'
            }</p>
            {!search && (
              <button
                className="btn btn-gold"
                onClick={() => setShowAddModal(true)}
                style={{ marginTop: 20 }}
              >
                + Add First Product
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && products.length > 0 && (
          <div className="products-grid">
            {products.map((p, i) => (
              <div
                key={p.product_id}
                className="card fade-in"
                style={{
                  animationDelay: `${i * 0.05}s`,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative',
                }}
                onClick={() => onSelectProduct(p.product_id)}
              >
                {/* Image */}
                <div style={{
                  width: '100%',
                  aspectRatio: '3/4',
                  background: 'linear-gradient(135deg, #e8d5b0, #d4b896)',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  {p.first_image && !imgErrors[p.product_id] ? (
                    <img
                      src={getImageUrl(p.first_image)}
                      alt={p.product_id}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setImgErrors(prev => ({ ...prev, [p.product_id]: true }))}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '3rem',
                    }}>🥻</div>
                  )}
                  {/* Variant badge */}
                  <div style={{
                    position: 'absolute',
                    top: 8, right: 8,
                    background: 'rgba(61,13,24,0.88)',
                    border: '1px solid var(--gold)',
                    color: 'var(--gold)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 20,
                    letterSpacing: '0.05em',
                  }}>
                    {p.variant_count} colour{p.variant_count !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Card info */}
                <div style={{ padding: '12px 14px 14px' }}>
                  <h3 style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--maroon)',
                    letterSpacing: '0.08em',
                    marginBottom: 6,
                  }}>
                    {p.product_id}
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-medium)',
                      fontStyle: 'italic',
                    }}>
                      View details →
                    </span>
                    <button
                      className="btn"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                      style={{
                        background: 'none',
                        color: '#c0392b',
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        borderRadius: 4,
                      }}
                      title="Delete product"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
