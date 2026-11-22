import { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { fetchProduct, deleteVariant, deleteProduct, getImageUrl, getProxyUrl } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAdmin } from '../hooks/useAdmin';
import VariantModal from '../components/VariantModal';
import ConfirmModal from '../components/ConfirmModal';
import EditDetailsModal from '../components/EditDetailsModal';
import ImageViewer from '../components/ImageViewer';
import PageHeader from '../components/PageHeader';
import { EnquiryBar } from '../components/WhatsApp';
import { hasWhatsApp, designEnquiry } from '../utils/whatsapp';
import { addRecent, removeRecent } from '../utils/recent';

export default function ProductPage({ productId, onBack, onRenamed, onMenu }) {
  const toast = useToast();
  const { isAdmin } = useAdmin();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [editVariant, setEditVariant] = useState(null);
  const [deleteVariantTarget, setDeleteVariantTarget] = useState(null);
  const [showDeleteProduct, setShowDeleteProduct] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [expandedDesc, setExpandedDesc] = useState({});
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [viewIndex, setViewIndex] = useState(null);
  const [showEditDetails, setShowEditDetails] = useState(false);

  const closeViewer = useCallback(() => setViewIndex(null), []);

  useLayoutEffect(() => { window.scrollTo(0, 0); }, [productId]);

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
      if (data.variants?.length) addRecent(productId, data.variants[0].image_path);
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
    removeRecent(productId);
    toast(`Design ${productId} deleted`);
    onBack();
  };

const handleDownloadSelected = async () => {
  const selected = product.variants.filter(v => selectedVariants.includes(v.id));
  toast(`Downloading ${selected.length} image${selected.length > 1 ? 's' : ''}...`, 'info');

  for (const v of selected) {
    try {
      const res = await fetch(getProxyUrl(v.image_path)); // ← proxy
      const blob = await res.blob();
      const ext = getImageUrl(v.image_path).split('.').pop().split('?')[0] || 'jpg';
      const fileName = `${productId}-Colour${v.variant_number}.${ext}`;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      toast(`Failed: Colour ${v.variant_number}`, 'error');
    }
  }
  toast('Done! ✓', 'success');
};

const handleShareSelected = async () => {
  const selected = product.variants.filter(v => selectedVariants.includes(v.id));
  try {
    toast('Preparing...', 'info');
    const files = await Promise.all(
      selected.map(async (v) => {
        const res = await fetch(getProxyUrl(v.image_path)); // ← proxy
        const blob = await res.blob();
        const ext = getImageUrl(v.image_path).split('.').pop().split('?')[0] || 'jpg';
        return new File(
          [blob],
          `${productId}-Colour${v.variant_number}.${ext}`,
          { type: blob.type }
        );
      })
    );
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files });
      return;
    }
  } catch (err) {
    console.error('Share failed:', err.message);
  }
  // Fallback
  const selected2 = product.variants.filter(v => selectedVariants.includes(v.id));
  for (const v of selected2) {
    window.open(getImageUrl(v.image_path), '_blank');
  }
  toast('Long-press each image to save 💡', 'info');
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

  const selectedColours = product
    ? product.variants.filter(v => selectedVariants.includes(v.id)).map(v => v.variant_number)
    : [];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: hasWhatsApp ? 120 : 80 }}>

      <PageHeader
        eyebrow={product?.category || 'Design'}
        title={productId}
        onBack={onBack}
        onMenu={onMenu}
        actions={isAdmin && (
          <button
            className="btn btn-danger-text btn-sm"
            onClick={() => setShowDeleteProduct(true)}
            title="Delete this design"
          >
            🗑 Delete
          </button>
        )}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="page-body">

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && product && (
          <>
            {/* Toolbar: colour count, or actions for the selected colours */}
            <div className="toolbar">
              {selectedVariants.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Desktop: download */}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleDownloadSelected}
                    style={{ display: /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'none' : 'flex' }}
                  >
                    ⬇ Download {selectedVariants.length}
                  </button>

                  {/* Mobile: native share sheet */}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleShareSelected}
                    style={{ display: /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'flex' : 'none' }}
                  >
                    ↗ Share {selectedVariants.length}
                  </button>

                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedVariants([])}>
                    ✕ Clear
                  </button>
                </div>
              ) : (
                <span className="muted">
                  {product.variants.length} colour{product.variants.length !== 1 ? 's' : ''}
                  {product.variants.length > 0 && ' · tap a photo to see it full screen'}
                </span>
              )}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowEditDetails(true)} title="Change design number or category">
                    ✏ Edit Details
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddVariant(true)}>
                    + Add Colour
                  </button>
                </div>
              )}
            </div>

            {/* Empty state */}
            {product.variants.length === 0 && (
              <div className="empty-state fade-in">
                <span className="emoji">🎨</span>
                <h3>No colour variants yet</h3>
                <p>{isAdmin ? `Add your first colour variant for ${productId}` : 'Photos are coming soon.'}</p>
                {isAdmin && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowAddVariant(true)}
                    style={{ marginTop: 20 }}
                  >
                    + Add First Colour
                  </button>
                )}
              </div>
            )}

            {/* Variants grid */}
            {product.variants.length > 0 && (
              <div className="variants-grid">
                {product.variants.map((v, i) => (
                  <div
                    key={v.id}
                    className="card fade-in"
                    style={{ animationDelay: `${Math.min(i, 12) * 0.06}s`, cursor: 'default' }}
                  >
                    <div
                      className="card-photo"
                      style={{ cursor: imgErrors[v.id] ? 'default' : 'zoom-in' }}
                      onClick={() => !imgErrors[v.id] && setViewIndex(i)}
                    >
                      {!imgErrors[v.id] ? (
                        <img
                          src={getImageUrl(v.image_path)}
                          alt={`Colour ${v.variant_number}`}
                          loading="lazy"
                          decoding="async"
                          onError={() => setImgErrors(prev => ({ ...prev, [v.id]: true }))}
                        />
                      ) : (
                        <div className="fallback">🥻</div>
                      )}
                    </div>

                    <div className="card-row" style={{ marginTop: 10 }}>
                      <h3 className="card-title" style={{ marginTop: 0 }}>Colour {v.variant_number}</h3>
                      <button
                        className={`select-toggle${selectedVariants.includes(v.id) ? ' on' : ''}`}
                        onClick={() => toggleSelect(v.id)}
                        aria-pressed={selectedVariants.includes(v.id)}
                      >
                        {selectedVariants.includes(v.id) ? '✓ Selected' : 'Select'}
                      </button>
                    </div>

                    {v.description && (
                      <>
                        <p className="card-desc" style={{
                          display: expandedDesc[v.id] ? 'block' : '-webkit-box',
                          WebkitLineClamp: expandedDesc[v.id] ? 'none' : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: expandedDesc[v.id] ? 'visible' : 'hidden',
                        }}>
                          {v.description}
                        </p>
                        {v.description.length > 80 && (
                          <button className="link-btn" onClick={() => toggleDesc(v.id)}>
                            {expandedDesc[v.id] ? 'Show less ▲' : 'Read more ▼'}
                          </button>
                        )}
                      </>
                    )}

                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditVariant(v)}>
                          ✏ Edit
                        </button>
                        <button
                          className="btn btn-danger-text btn-sm"
                          onClick={() => setDeleteVariantTarget(v)}
                          title="Delete colour"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {hasWhatsApp && product && (
        <EnquiryBar
          message={designEnquiry(productId, selectedColours)}
          label={selectedColours.length
            ? `Enquire about ${selectedColours.length} colour${selectedColours.length > 1 ? 's' : ''}`
            : 'Enquire on WhatsApp'}
        />
      )}

      {/* ── FULLSCREEN IMAGE VIEWER (swipe between colours) ── */}
      {viewIndex !== null && product && (
        <ImageViewer
          productId={productId}
          variants={product.variants}
          startIndex={viewIndex}
          onClose={closeViewer}
          onDownload={handleDownload}
        />
      )}

      {/* ── MODALS ── */}
      {showEditDetails && (
        <EditDetailsModal
          productId={productId}
          category={product?.category}
          onClose={() => setShowEditDetails(false)}
          onSaved={newId => (newId === productId ? load() : onRenamed(newId))}
        />
      )}

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
          title={`Delete Colour ${deleteVariantTarget.variant_number}?`}
          message={`This permanently deletes colour ${deleteVariantTarget.variant_number} of design ${productId} and its photo. This cannot be undone.`}
          confirmLabel="Delete Colour"
          onConfirm={handleDeleteVariant}
          onCancel={() => setDeleteVariantTarget(null)}
        />
      )}

      {showDeleteProduct && (
        <ConfirmModal
          title={`Delete Design ${productId}?`}
          message="This permanently deletes the design with all its colours and photos. This cannot be undone."
          confirmLabel="Delete Design"
          onConfirm={handleDeleteProduct}
          onCancel={() => setShowDeleteProduct(false)}
        />
      )}
    </div>
  );
}
