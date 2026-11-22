import { useState, useEffect, useLayoutEffect } from 'react';
import PageHeader from '../components/PageHeader';
import StaffLoginModal from '../components/StaffLoginModal';
import ImageUpload from '../components/ImageUpload';
import { fetchIdentifyStatus, identifyPhoto, getImageUrl } from '../utils/api';
import { shrinkPhoto } from '../utils/photo';
import { useAdmin } from '../hooks/useAdmin';

export default function IdentifyPage({ onBack, onMenu, onSelectProduct }) {
  const { isAdmin, logout } = useAdmin();
  const [showLogin, setShowLogin] = useState(false);
  const [status, setStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [hint, setHint] = useState('');
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');

  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchIdentifyStatus()
      .then(setStatus)
      .catch(err => { if (err.message === 'Unauthorized') logout(); });
  }, [isAdmin, logout]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const handleFile = (f) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setMatches(null);
    setError('');
  };

  const handleFind = async () => {
    setMatching(true);
    setError('');
    try {
      const result = await identifyPhoto(await shrinkPhoto(file), hint.trim());
      setMatches(result.matches);
      setStatus(s => ({ ...s, indexed: result.indexed, total: result.total }));
    } catch (err) {
      if (err.message === 'Unauthorized') logout();
      else setError(err.message);
    } finally {
      setMatching(false);
    }
  };

  const stillIndexing = status?.configured && status.indexed < status.total;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <PageHeader eyebrow="Staff" title="Find by photo" onBack={onBack} onMenu={onMenu} />

      <div className="page-body identify-page">
        {!isAdmin ? (
          <div className="empty-state">
            <h3>Staff only</h3>
            <p>Log in with the staff password to find a design from a photo of the saree.</p>
            <button className="btn btn-primary" onClick={() => setShowLogin(true)} style={{ marginTop: 20 }}>
              Staff login
            </button>
          </div>
        ) : (
          <>
            <p className="identify-intro">
              Take a photo of a returned saree to see which catalogue designs it looks like.
            </p>

            {status && !status.configured && (
              <p className="identify-note">Find by photo isn't switched on yet. It needs a Gemini API key on the server.</p>
            )}
            {stillIndexing && (
              <p className="identify-note">
                Still learning the catalogue: {status.indexed.toLocaleString()} of {status.total.toLocaleString()} photos
                done. Designs that aren't learned yet won't show up in matches.
              </p>
            )}

            <ImageUpload onFileSelect={handleFile} preview={preview} label="Photo of the saree" />
            <p className="field-hint">Spread it out in good light so the border and pallu show clearly.</p>

            <div style={{ marginTop: 16 }}>
              <label className="label" htmlFor="identify-hint">
                Anything you know<span className="label-optional">optional</span>
              </label>
              <input
                id="identify-hint"
                className="input"
                placeholder="e.g. Banarasi, red with gold border"
                value={hint}
                onChange={e => setHint(e.target.value)}
                maxLength={200}
              />
            </div>

            <button
              className="btn btn-primary identify-find"
              onClick={handleFind}
              disabled={!file || matching || status?.configured === false}
            >
              {matching ? 'Matching...' : 'Find matching designs'}
            </button>
            {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}

            {matches && matches.length === 0 && (
              <div className="empty-state">
                <h3>No matches yet</h3>
                <p>The catalogue photos haven't been learned yet. Try again in a little while.</p>
              </div>
            )}

            {matches && matches.length > 0 && (
              <section>
                <p className="menu-heading" style={{ padding: 0, margin: '28px 0 10px' }}>Closest designs</p>
                <ol className="stat-list identify-results">
                  {matches.map((m, i) => (
                    <li key={m.product_id}>
                      <button className="stat-row" onClick={() => onSelectProduct(m.product_id)}>
                        <span className="identify-rank">{i + 1}</span>
                        <img src={getImageUrl(m.image_path)} alt="" loading="lazy" />
                        <span className="stat-row-main">
                          <span className="stat-row-id">{m.product_id}</span>
                          <span className="muted">
                            Colour {m.variant_number}{m.category ? ` · ${m.category}` : ''}
                          </span>
                        </span>
                        <span className="identify-open" aria-hidden="true">›</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="field-hint">Ranked by how closely each design's photos match. Tap one to compare all its colours.</p>
              </section>
            )}
          </>
        )}
      </div>

      {showLogin && <StaffLoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
