import { useState, useRef } from 'react';
import { addVariant, updateVariant, getImageUrl, setAdminPassword, getAdminPassword } from '../utils/api';
import { useToast } from '../hooks/useToast';
import PasswordGate from './PasswordGate';

export default function VariantModal({ productId, variant, onClose, onSuccess }) {
  const toast = useToast();
  const isEdit = !!variant;
  const fileInputRef = useRef(null);

  // Password gate — skipped when staff mode already holds the password
  const [password, setPassword] = useState(getAdminPassword);
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = (value) => {
    setAdminPassword(value);
    setPassword(value);
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
      toast(`Colour ${variant.variant_number} updated`);
      onSuccess();
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
      toast(`${successCount} colour${successCount > 1 ? 's' : ''} added`);
      onSuccess();
      onClose();
    }
  };

  const header = (title) => (
    <div className="modal-head">
      <h2 className="modal-title">{title}</h2>
      <p className="modal-sub">Design {productId}</p>
    </div>
  );

  // ── PASSWORD GATE (shows before everything) ───────────────────────────────
  if (!password) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
          {header(isEdit ? `Edit Colour ${variant.variant_number}` : 'Add Colours')}
          <PasswordGate error={passwordError} onSubmit={handlePasswordSubmit} onCancel={onClose} />
        </div>
      </div>
    );
  }

  // ── RENDER: EDIT ──────────────────────────────────────────────────────────
  if (isEdit) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
          {header(`Edit Colour ${variant.variant_number}`)}
          <div className="modal-form">
            <div>
              <label className="label">Photo</label>
              <div className="photo-frame" style={{ marginBottom: 10 }}>
                <img src={editPreview} alt="Current" style={{ maxHeight: 220 }} />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditFile} />
              <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ width: '100%', justifyContent: 'center' }}>
                Replace photo (optional)
              </button>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" placeholder="e.g. Emerald green with silver zari" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSubmit} disabled={loading}>
                {loading && <span className="spinner spinner-sm" />}
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
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
          {header('Add Colours')}
          <div className="modal-form">
            <p className="modal-text">
              Pick one or more photos from your gallery. You can add a description to each one next.
            </p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFilePick} />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                Choose Photos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: DESCRIBE PHOTOS (SLIDER) ─────────────────────────────────────
  const current = photos[currentIndex];
  const allDone = currentIndex === photos.length - 1;

  return (
    <div className="modal-overlay" onClick={e => e.stopPropagation()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '95vh', overflowY: 'auto', padding: '24px 20px' }}>
        {header('Add Descriptions')}
        <div className="step-dots">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Photo ${i + 1}`}
              className={`step-dot ${i === currentIndex ? 'active' : i < currentIndex ? 'done' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <p className="step-count">Photo {currentIndex + 1} of {photos.length}</p>
        <div className="photo-frame" style={{ marginBottom: 16 }}>
          <img src={current.preview} alt={`Photo ${currentIndex + 1}`} style={{ maxHeight: 260 }} />
          {currentIndex > 0 && (
            <button className="photo-nav prev" onClick={() => goTo(currentIndex - 1)} aria-label="Previous photo">‹</button>
          )}
          {currentIndex < photos.length - 1 && (
            <button className="photo-nav next" onClick={() => goTo(currentIndex + 1)} aria-label="Next photo">›</button>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="label">
            Description for photo {currentIndex + 1}
            <span className="label-optional">optional</span>
          </label>
          <textarea className="input" placeholder="e.g. Deep red Banarasi silk with gold zari border" value={current.description} onChange={e => updateDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} autoFocus />
        </div>
        <div className="modal-actions">
          {currentIndex > 0 && (
            <button className="btn btn-secondary" onClick={() => goTo(currentIndex - 1)}>‹ Back</button>
          )}
          {!allDone ? (
            <button className="btn btn-primary" onClick={() => goTo(currentIndex + 1)}>Next ›</button>
          ) : (
            <button className="btn btn-primary" onClick={handleMultiSubmit} disabled={loading}>
              {loading ? (
                <><span className="spinner spinner-sm" />Uploading {uploadProgress}/{photos.length}...</>
              ) : (
                `Save ${photos.length} Colour${photos.length > 1 ? 's' : ''}`
              )}
            </button>
          )}
        </div>
        {!loading && (
          <button className="btn btn-ghost" onClick={() => { setStep('pick'); setPhotos([]); }} style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--muted)' }}>
            Start over
          </button>
        )}
      </div>
    </div>
  );
}
