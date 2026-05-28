import { useState, useRef } from 'react';
import { addVariant, updateVariant, getImageUrl, setAdminPassword, getAdminPassword } from '../utils/api';
import { useToast } from '../hooks/useToast';

export default function VariantModal({ productId, variant, onClose, onSuccess }) {
  const toast = useToast();
  const isEdit = !!variant;
  const fileInputRef = useRef(null);

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

  // Edit mode state
  const [editDescription, setEditDescription] = useState(variant?.description || '');
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState(variant ? getImageUrl(variant.image_path) : '');

  // Multi-add mode state
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState('pick');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── EDIT MODE ─────────────────────────────────────────────────────────────
  const handleEditFile = (e) => {
    const f = e.target.files[0];
    if (f) {
      setEditFile(f);
      setEditPreview(URL.createObjectURL(f));
    }
  };

  const handleEditSubmit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('product_id', productId);
      fd.append('description', editDescription);
      if (editFile) fd.append('image', editFile);
      await updateVariant(variant.id, fd);
      toast('Colour variant updated! ✨');
      onSuccess();
      onClose();
    } catch (err) {
      if (err.message === 'Unauthorized') {
        setAdminPassword('');
        setPassword('');
        setPasswordInput('');
        setPasswordError('Wrong password. Try again.');
      } else {
        toast(err.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── MULTI-ADD MODE ────────────────────────────────────────────────────────
  const handleFilePick = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPhotos = files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      description: '',
    }));
    setPhotos(newPhotos);
    setCurrentIndex(0);
    setStep('describe');
  };

  const updateDescription = (val) => {
    setPhotos(prev => prev.map((p, i) => i === currentIndex ? { ...p, description: val } : p));
  };

  const goTo = (idx) => {
    if (idx >= 0 && idx < photos.length) setCurrentIndex(idx);
  };

  const handleMultiSubmit = async () => {
    setLoading(true);
    setUploadProgress(0);
    let successCount = 0;
    for (let i = 0; i < photos.length; i++) {
      try {
        const fd = new FormData();
        fd.append('product_id', productId);
        fd.append('description', photos[i].description);
        fd.append('image', photos[i].file);
        await addVariant(fd);
        successCount++;
      } catch (err) {
        if (err.message === 'Unauthorized') {
          setAdminPassword('');
          setPassword('');
          setPasswordInput('');
          setPasswordError('Wrong password. Try again.');
          setLoading(false);
          return;
        }
        toast(`Photo ${i + 1} failed: ${err.message}`, 'error');
      }
      setUploadProgress(i + 1);
    }
    setLoading(false);
    if (successCount > 0) {
      toast(`${successCount} colour variant${successCount > 1 ? 's' : ''} added! 🥻`);
      onSuccess();
      onClose();
    }
  };

  // ── PASSWORD GATE (shows before everything) ───────────────────────────────
  if (!password) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            color: 'var(--gold)',
            fontSize: '1.5rem',
            marginBottom: 4,
          }}>
            {isEdit ? `Edit Colour ${variant.variant_number}` : 'Add Colour Variants'}
          </h2>
          <p style={{ color: 'var(--gold)', opacity: 0.6, fontSize: '0.85rem', marginBottom: 20 }}>
            {productId}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'rgba(250,243,224,0.6)', fontSize: '0.9rem' }}>
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
        </div>
      </div>
    );
  }

  // ── RENDER: EDIT ──────────────────────────────────────────────────────────
  if (isEdit) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--gold)', fontSize: '1.5rem', marginBottom: 4, textAlign: 'center' }}>
            Edit Colour {variant.variant_number}
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--gold)', opacity: 0.6, fontSize: '0.85rem', marginBottom: 6 }}>{productId}</p>
          <div className="ornament" style={{ marginBottom: 20 }}>❧ ✦ ❧</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="label">Image</label>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1.5px solid rgba(201,168,76,0.3)', marginBottom: 10, background: 'rgba(0,0,0,0.2)' }}>
                <img src={editPreview} alt="Current" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }} />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditFile} />
              <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', justifyContent: 'center' }}>
                📷 Replace Image (optional)
              </button>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" placeholder="e.g. Emerald green with silver zari..." value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
              <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-gold" onClick={handleEditSubmit} disabled={loading} style={{ flex: 2 }}>
                {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : '✦'}
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: PICK PHOTOS ───────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--gold)', fontSize: '1.5rem', marginBottom: 4 }}>
            Add Colour Variants
          </h2>
          <p style={{ color: 'var(--gold)', opacity: 0.6, fontSize: '0.85rem', marginBottom: 6 }}>{productId}</p>
          <div className="ornament" style={{ marginBottom: 24 }}>❧ ✦ ❧</div>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🖼️</div>
          <p style={{ color: 'rgba(250,243,224,0.8)', marginBottom: 8, fontSize: '1rem', fontWeight: 600 }}>
            Select one or multiple photos
          </p>
          <p style={{ color: 'rgba(250,243,224,0.45)', fontSize: '0.85rem', marginBottom: 28, lineHeight: 1.5 }}>
            You can pick multiple photos from your gallery at once — then add descriptions to each one individually.
          </p>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFilePick} />
          <button className="btn btn-gold" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', fontSize: '1rem' }}>
            📂 Choose from Gallery
          </button>
          <button className="btn btn-outline" onClick={onClose} style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: DESCRIBE PHOTOS (SLIDER) ─────────────────────────────────────
  const current = photos[currentIndex];
  const allDone = currentIndex === photos.length - 1;

  return (
    <div className="modal-overlay" onClick={e => e.stopPropagation()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '95vh', overflowY: 'auto', padding: '24px 20px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--gold)', fontSize: '1.3rem', marginBottom: 2 }}>
            Add Descriptions
          </h2>
          <p style={{ color: 'rgba(201,168,76,0.6)', fontSize: '0.82rem' }}>{productId}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
          {photos.map((_, i) => (
            <div key={i} onClick={() => goTo(i)} style={{ width: i === currentIndex ? 24 : 8, height: 8, borderRadius: 4, background: i === currentIndex ? 'var(--gold)' : i < currentIndex ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.2)', cursor: 'pointer', transition: 'all 0.25s ease' }} />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)', borderRadius: 20, padding: '3px 14px', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em' }}>
            Photo {currentIndex + 1} of {photos.length}
          </span>
        </div>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid rgba(201,168,76,0.3)', background: 'rgba(0,0,0,0.3)', marginBottom: 16, position: 'relative' }}>
          <img src={current.preview} alt={`Photo ${currentIndex + 1}`} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
          {photos.length > 1 && (
            <>
              {currentIndex > 0 && (
                <button onClick={() => goTo(currentIndex - 1)} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(61,13,24,0.8)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
              )}
              {currentIndex < photos.length - 1 && (
                <button onClick={() => goTo(currentIndex + 1)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(61,13,24,0.8)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: '1rem' }}>›</button>
              )}
            </>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="label">
            Description for Photo {currentIndex + 1}
            <span style={{ color: 'rgba(201,168,76,0.4)', fontWeight: 400, marginLeft: 6 }}>(optional)</span>
          </label>
          <textarea className="input" placeholder="e.g. Deep red Banarasi silk with gold zari border..." value={current.description} onChange={e => updateDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} autoFocus />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {currentIndex > 0 && (
            <button className="btn btn-outline" onClick={() => goTo(currentIndex - 1)} style={{ flex: 1 }}>‹ Prev</button>
          )}
          {!allDone ? (
            <button className="btn btn-gold" onClick={() => goTo(currentIndex + 1)} style={{ flex: 2, justifyContent: 'center' }}>Next ›</button>
          ) : (
            <button className="btn btn-gold" onClick={handleMultiSubmit} disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />Uploading {uploadProgress}/{photos.length}...</>
              ) : (
                `✦ Save All ${photos.length} Colour${photos.length > 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
        {!loading && (
          <button className="btn" onClick={() => { setStep('pick'); setPhotos([]); }} style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'rgba(250,243,224,0.35)', background: 'none', fontSize: '0.8rem' }}>
            ✕ Cancel / Start Over
          </button>
        )}
      </div>
    </div>
  );
}
