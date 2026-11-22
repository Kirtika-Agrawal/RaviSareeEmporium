import { useState, useEffect, useLayoutEffect } from 'react';
import PageHeader from '../components/PageHeader';
import StaffLoginModal from '../components/StaffLoginModal';
import ImageUpload from '../components/ImageUpload';
import { fetchIdentifyStatus, identifyPhoto, sendIdentifyFeedback, getImageUrl } from '../utils/api';
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
  const [searched, setSearched] = useState(null); // { photo, hint } behind the current matches
  const [feedback, setFeedback] = useState('idle'); // 'idle' | 'other' | 'saving' | 'saved'
  const [otherId, setOtherId] = useState('');
  const [savedId, setSavedId] = useState('');

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
      const photo = await shrinkPhoto(file);
      const result = await identifyPhoto(photo, hint.trim());
      const { matches: found, ...latestStatus } = result;
      setMatches(found);
      setStatus(latestStatus);
      setSearched({ photo, hint: hint.trim() });
      setFeedback('idle');
      setOtherId('');
    } catch (err) {
      if (err.message === 'Unauthorized') logout();
      else setError(err.message);
    } finally {
      setMatching(false);
    }
  };

  const saveFeedback = async (productId) => {
    const id = productId.trim().toUpperCase();
    if (!id) return;
    setFeedback('saving');
    setError('');
    try {
      const latestStatus = await sendIdentifyFeedback(searched.photo, id, matches.map(m => m.product_id), searched.hint);
      setStatus(latestStatus);
      setSavedId(id);
      setFeedback('saved');
    } catch (err) {
      if (err.message === 'Unauthorized') logout();
      setError(err.message);
      setFeedback(matches.some(m => m.product_id === id) ? 'idle' : 'other');
    }
  };

  const stillIndexing = status?.configured && status.indexed < status.total;
  const addingCloseups = status?.configured && !stillIndexing && status.closeups < status.closeupsTotal;
  const checked = status?.feedback?.checked || 0;

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
            {addingCloseups && (
              <p className="identify-note">
                Every design can be matched. Close-ups of the fabric and border are still being added
                ({status.closeups.toLocaleString()} of {status.closeupsTotal.toLocaleString()}), which helps with photos of folded sarees.
              </p>
            )}
            {checked > 0 && (
              <p className="identify-accuracy">
                So far the right design was in the top 5 for <strong>{status.feedback.top} of {checked}</strong> checked
                photo{checked === 1 ? '' : 's'}, and first for {status.feedback.first}.
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

                <div className="identify-feedback">
                  {feedback === 'saved' ? (
                    <p className="identify-thanks">
                      ✓ Saved as design {savedId}. Thanks, this keeps track of how accurate matching is.
                    </p>
                  ) : (
                    <>
                      <p className="label">Which one was it?</p>
                      <div className="chip-row chip-row-wrap">
                        {matches.map(m => (
                          <button
                            key={m.product_id}
                            className="chip"
                            onClick={() => saveFeedback(m.product_id)}
                            disabled={feedback === 'saving'}
                          >
                            {m.product_id}
                          </button>
                        ))}
                        <button
                          className={`chip ${feedback === 'other' ? 'active' : ''}`}
                          onClick={() => setFeedback('other')}
                          disabled={feedback === 'saving'}
                        >
                          Not listed
                        </button>
                      </div>
                      {feedback === 'other' && (
                        <form
                          className="identify-other"
                          onSubmit={e => { e.preventDefault(); saveFeedback(otherId); }}
                        >
                          <input
                            className="input"
                            placeholder="Correct design number"
                            value={otherId}
                            onChange={e => setOtherId(e.target.value.toUpperCase())}
                            autoFocus
                          />
                          <button className="btn btn-primary" type="submit" disabled={!otherId.trim()}>Save</button>
                        </form>
                      )}
                      <p className="field-hint">The photo is saved with the right design number to check accuracy and improve matching later.</p>
                    </>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {showLogin && <StaffLoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
