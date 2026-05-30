import { useState, useEffect, useCallback } from 'react';
import { fetchProduct, deleteVariant, deleteProduct, getImageUrl } from '../utils/api';
import { useToast } from '../hooks/useToast';
import VariantModal from '../components/VariantModal';
import ConfirmModal from '../components/ConfirmModal';

export default function ProductPage({ productId, onBack }) {
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [editVariant, setEditVariant] = useState(null);
  const [deleteVariantTarget, setDeleteVariantTarget] = useState(null);
  const [showDeleteProduct, setShowDeleteProduct] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [expandedDesc, setExpandedDesc] = useState({});
  const [selectedVariants, setSelectedVariants] = useState([]);

  const toggleSelect = (id) => {
    setSelectedVariants(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProduct(productId);
      setProduct(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, toast]);

  useEffect(() => { load(); }, [load]);

  const handleVariantSaved = () => { load(); };

  const handleDeleteVariant = async () => {
    try {
      await deleteVariant(deleteVariantTarget.id);
      toast('Colour variant deleted');
      setDeleteVariantTarget(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleShareSelected = () => {
    const selected = product.variants.filter(v => selectedVariants.includes(v.id));
    const text = selected.map(v =>
      `Colour ${v.variant_number}${v.description ? ' - ' + v.description : ''}:\n${getImageUrl(v.image_path)}`
    ).join('\n\n');

    const message = `*${productId}* - Selected Colour Variants:\n\n${text}`;

    if (navigator.share) {
      navigator.share({ title: productId, text: message });
    } else {
      const encoded = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleDeleteProduct = async () => {
    try {
      await deleteProduct(productId);
      toast(`Product ${productId} deleted`);
      onBack();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggleDesc = (id) => {
    setExpandedDesc(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(61,13,24,0.98) 0%, rgba(90,18,32,0.95) 100%)',
        borderBottom: '1px solid rgba(201,168,76,0.3)',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Top row: back + title + delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button
              className="btn btn-outline"
              onClick={onBack}
              style={{ padding: '8px 14px', fontSize: '0.8rem', flexShrink: 0 }}
            >
              ← Back
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: 'rgba(201,168,76,0.5)', letterSpacing: '0.2em', marginBottom: 2 }}>
                PRODUCT ID
              </div>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
                color: 'var(--gold)',
                letterSpacing: '0.1em',
                textShadow: '0 2px 10px rgba(201,168,76,0.4)',
              }}>
                {productId}
              </h1>
            </div>
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteProduct(true)}
              style={{ padding: '8px 12px', fontSize: '0.75rem', flexShrink: 0 }}
              title="Delete entire product"
            >
              🗑 Delete
            </button>
          </div>

          {/* Subtitle row */}
          {product && (
            <div style={{ textAlign: 'center' }}>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: 'italic',
                color: 'rgba(201,168,76,0.55)',
                fontSize: '0.85rem',
              }}>
                {product.variants.length} colour variant{product.variants.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && product && (
          <>
            {/* Add variant button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              {selectedVariants.length > 0 && (
                <button
                  className="btn btn-gold"
                  onClick={handleShareSelected}
                  style={{ marginRight: 8 }}
                >
                  ↗ Share {selectedVariants.length} Selected
                </button>
              )}
              {selectedVariants.length > 0 && (
                <button
                  className="btn btn-outline"
                  onClick={() => setSelectedVariants([])}
                  style={{ fontSize: '0.8rem' }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <button
              className="btn btn-gold"
              onClick={() => setShowAddVariant(true)}
            >
              <span>+</span> Add Colour Variant
            </button>
          </div>

            <div className="ornamental-divider">
              <span>❖ Colour Variants ❖</span>
            </div>

            {/* Empty variants */}
            {product.variants.length === 0 && (
              <div className="empty-state fade-in">
                <span className="emoji">🎨</span>
                <h3>No colour variants yet</h3>
                <p>Add your first colour variant for {productId}</p>
                <button
                  className="btn btn-gold"
                  onClick={() => setShowAddVariant(true)}
                  style={{ marginTop: 20 }}
                >
                  + Add First Colour
                </button>
              </div>
            )}

            {/* Variants grid */}
            {product.variants.length > 0 && (
              <div className="variants-grid">
                {product.variants.map((v, i) => (
                  <div
                    key={v.id}
                    className="card fade-in"
                    style={{
                      animationDelay: `${i * 0.06}s`,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                  {/* Checkbox */}
                    <div
                      onClick={() => toggleSelect(v.id)}
                      style={{
                        position: 'absolute',
                        top: 10,
                        left: 10,
                        zIndex: 10,
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: `2px solid ${selectedVariants.includes(v.id) ? 'var(--gold)' : 'rgba(201,168,76,0.4)'}`,
                        background: selectedVariants.includes(v.id) ? 'var(--gold)' : 'rgba(61,13,24,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      {selectedVariants.includes(v.id) && '✓'}
                    </div>
                    {/* Variant label */}
                    <div style={{
                      padding: '10px 16px 8px',
                      borderBottom: '1px solid rgba(201,168,76,0.2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <span style={{
                          fontFamily: "'Playfair Display', serif",
                          fontWeight: 700,
                          color: 'var(--maroon)',
                          fontSize: '0.95rem',
                        }}>
                          Colour {v.variant_number}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => setEditVariant(v)}
                          style={{
                            padding: '5px 12px',
                            fontSize: '0.75rem',
                            color: 'var(--maroon)',
                            borderColor: 'rgba(123,28,46,0.3)',
                          }}
                        >
                          ✏ Edit
                        </button>
                        <button
                          className="btn"
                          onClick={() => setDeleteVariantTarget(v)}
                          style={{
                            background: 'none',
                            color: '#c0392b',
                            padding: '5px 10px',
                            fontSize: '0.75rem',
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>

                    {/* Image */}
                    <div style={{
                      width: '100%',
                      aspectRatio: '3/4',
                      background: 'linear-gradient(135deg, #e8d5b0, #d4b896)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      {!imgErrors[v.id] ? (
                        <img
                          src={getImageUrl(v.image_path)}
                          alt={`Colour ${v.variant_number}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={() => setImgErrors(prev => ({ ...prev, [v.id]: true }))}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '3rem',
                        }}>🥻</div>
                      )}
                    </div>

                    {/* Description */}
                    <div style={{ padding: '12px 16px 16px' }}>
                      {v.description ? (
                        <>
                          <p style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-medium)',
                            lineHeight: 1.5,
                            display: expandedDesc[v.id] ? 'block' : '-webkit-box',
                            WebkitLineClamp: expandedDesc[v.id] ? 'none' : 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: expandedDesc[v.id] ? 'visible' : 'hidden',
                          }}>
                            {v.description}
                          </p>
                          {v.description.length > 80 && (
                            <button
                              onClick={() => toggleDesc(v.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--maroon)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: '4px 0',
                              }}
                            >
                              {expandedDesc[v.id] ? 'Show less ▲' : 'Read more ▼'}
                            </button>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                          No description
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddVariant && (
        <VariantModal
          productId={productId}
          onClose={() => setShowAddVariant(false)}
          onSuccess={handleVariantSaved}
        />
      )}

      {editVariant && (
        <VariantModal
          productId={productId}
          variant={editVariant}
          onClose={() => setEditVariant(null)}
          onSuccess={handleVariantSaved}
        />
      )}

      {deleteVariantTarget && (
        <ConfirmModal
          title="Delete Colour Variant?"
          message={`This will permanently delete Colour ${deleteVariantTarget.variant_number} of ${productId}. This cannot be undone.`}
          confirmLabel="Delete Variant"
          onConfirm={handleDeleteVariant}
          onCancel={() => setDeleteVariantTarget(null)}
        />
      )}

      {showDeleteProduct && (
        <ConfirmModal
          title="Delete Entire Product?"
          message={`This will permanently delete "${productId}" along with ALL its colour variants and images. This cannot be undone.`}
          confirmLabel="Delete Product"
          onConfirm={handleDeleteProduct}
          onCancel={() => setShowDeleteProduct(false)}
        />
      )}
    </div>
  );
}
