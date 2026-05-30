import { useState, useCallback, useEffect } from 'react';
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
  const [viewImage, setViewImage] = useState(null);

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
    await deleteVariant(deleteVariantTarget.id);
    toast('Colour variant deleted');
    setDeleteVariantTarget(null);
    load();
  };

  const handleDeleteProduct = async () => {
    await deleteProduct(productId);
    toast(`Product ${productId} deleted`);
    onBack();
  };

  const handleShareSelected = async () => {
  const selected = product.variants.filter(v => selectedVariants.includes(v.id));

  if (navigator.canShare) {
    try {
      toast('Fetching images...', 'info');
      
      const files = await Promise.all(
        selected.map(async (v) => {
          const url = getImageUrl(v.image_path);
          console.log('Fetching:', url);
          const res = await fetch(url);
          console.log('Response ok:', res.ok, 'Type:', res.type);
          const blob = await res.blob();
          console.log('Blob size:', blob.size, 'Blob type:', blob.type);
          const ext = url.split('.').pop().split('?')[0] || 'jpg';
          return new File(
            [blob],
            `${productId}-Colour${v.variant_number}.${ext}`,
            { type: blob.type }
          );
        })
      );

      console.log('Files ready:', files);
      console.log('canShare files?', navigator.canShare({ files }));

      if (navigator.canShare({ files })) {
        await navigator.share({
          title: `${productId} - Selected Colour Variants`,
          text: `${productId} - ${selected.length} colour variant${selected.length > 1 ? 's' : ''}`,
          files,
        });
        return;
      } else {
        console.log('canShare returned false for files');
      }
    } catch (err) {
      console.error('File share error:', err.name, err.message);
    }
  } else {
    console.log('navigator.canShare not available');
  }

  // Fallback
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

  // Fallback: share as text links (desktop or unsupported browsers)
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

  const handleDownload = async (e, imageUrl) => {
    e.stopPropagation();
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = imageUrl.split('/').pop();
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const toggleDesc = (id) => {
    setExpandedDesc(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── HEADER ── */}
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

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && product && (
          <>
            {/* Top bar: share selected + add variant */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedVariants.length > 0 && (
                  <button
                    className="btn btn-gold"
                    onClick={handleShareSelected}
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

            {/* Empty state */}
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
                    {/* ── Variant header: label + buttons ── */}
                    <div style={{
                      padding: '10px 16px 8px',
                      borderBottom: '1px solid rgba(201,168,76,0.2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{
                        fontFamily: "'Playfair Display', serif",
                        fontWeight: 700,
                        color: 'var(--maroon)',
                        fontSize: '0.95rem',
                      }}>
                        Colour {v.variant_number}
                      </span>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Checkbox */}
                        <div
                          onClick={() => toggleSelect(v.id)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: `2px solid ${selectedVariants.includes(v.id) ? 'var(--gold)' : 'rgba(201,168,76,0.4)'}`,
                            background: selectedVariants.includes(v.id) ? 'var(--gold)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: 'var(--maroon)',
                            flexShrink: 0,
                          }}
                        >
                          {selectedVariants.includes(v.id) && '✓'}
                        </div>

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

                    {/* ── Image (clickable → fullscreen) ── */}
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '3/4',
                        background: 'linear-gradient(135deg, #e8d5b0, #d4b896)',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'zoom-in',
                      }}
                      onClick={() => !imgErrors[v.id] && setViewImage(getImageUrl(v.image_path))}
                    >
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

                      {!imgErrors[v.id] && (
                        <div style={{
                          position: 'absolute',
                          bottom: 8, right: 8,
                          background: 'rgba(0,0,0,0.5)',
                          color: 'white',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: '0.7rem',
                        }}>
                          🔍 Tap to view
                        </div>
                      )}
                    </div>

                    {/* ── Description ── */}
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

      {/* ── FULLSCREEN IMAGE VIEWER ── */}
      {viewImage && (
        <div
          onClick={() => setViewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          {/* Close */}
          <button
            onClick={() => setViewImage(null)}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.4)',
              color: 'var(--gold)', borderRadius: '50%',
              width: 40, height: 40, fontSize: '1.2rem', cursor: 'pointer',
            }}
          >✕</button>

          {/* Download */}
          <button
            onClick={(e) => handleDownload(e, viewImage)}
            style={{
              position: 'absolute', top: 16, right: 64,
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.4)',
              color: 'var(--gold)', borderRadius: '50%',
              width: 40, height: 40, fontSize: '1.2rem', cursor: 'pointer',
            }}
            title="Download image"
          >⬇</button>

          <img
            src={viewImage}
            alt="Full view"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── MODALS ── */}
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
