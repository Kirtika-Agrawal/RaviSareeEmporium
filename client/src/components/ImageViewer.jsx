import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { getImageUrl, trackEvent } from '../utils/api';
import ZoomableImage from './ZoomableImage';
import { WhatsAppIcon } from './WhatsApp';
import { hasWhatsApp, whatsappLink, designEnquiry } from '../utils/whatsapp';

export default function ImageViewer({ productId, variants, startIndex, onClose, onDownload }) {
  const trackRef = useRef(null);
  const pushedHistory = useRef(false);
  const [index, setIndex] = useState(startIndex);
  const [failed, setFailed] = useState({});
  // While zoomed, one-finger drags pan the photo instead of changing colour.
  const [zoomed, setZoomed] = useState(false);

  // Jump straight to the tapped colour before the first paint.
  useLayoutEffect(() => {
    const track = trackRef.current;
    track.scrollLeft = startIndex * track.clientWidth;
  }, [startIndex]);

  // Give the viewer its own history entry so the phone's Back gesture closes
  // it instead of leaving the product page.
  useEffect(() => {
    if (!window.history.state?.viewer) {
      window.history.pushState({ ...window.history.state, viewer: true }, '');
      pushedHistory.current = true;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // iOS Safari zooms the whole page on pinch unless its gesture event is blocked.
    const blockPageZoom = (e) => e.preventDefault();
    document.addEventListener('gesturestart', blockPageZoom);
    window.addEventListener('popstate', onClose);
    return () => {
      window.removeEventListener('popstate', onClose);
      document.removeEventListener('gesturestart', blockPageZoom);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const close = () => {
    if (pushedHistory.current) window.history.back();
    else onClose();
  };

  const goTo = (i) => {
    const track = trackRef.current;
    const target = Math.max(0, Math.min(variants.length - 1, i));
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleScroll = () => {
    const track = trackRef.current;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const current = variants[index] ?? variants[0];
  const hasMany = variants.length > 1;

  return (
    <div className="viewer" role="dialog" aria-modal="true">
      <div
        className={`viewer-track${zoomed ? ' zoomed' : ''}`}
        ref={trackRef}
        onScroll={handleScroll}
      >
        {variants.map((v, i) => (
          <div
            key={v.id}
            className="viewer-slide"
            onClick={e => e.target === e.currentTarget && close()}
          >
            {failed[v.id] ? (
              <div style={{ fontSize: '4rem' }}>🥻</div>
            ) : (
              <ZoomableImage
                src={getImageUrl(v.image_path)}
                alt={`Colour ${v.variant_number}`}
                active={i === index}
                loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                onZoomChange={setZoomed}
                onBackgroundClick={close}
                onError={() => setFailed(prev => ({ ...prev, [v.id]: true }))}
              />
            )}
          </div>
        ))}
      </div>

      {!zoomed && (
        <p className="viewer-hint" style={{ bottom: hasMany ? 44 : 22 }}>
          <span className="hint-touch">Pinch or double-tap to zoom</span>
          <span className="hint-mouse">Double-click to zoom</span>
        </p>
      )}

      <div className="viewer-topbar">
        <span className="viewer-label">
          Colour {current.variant_number}
          {hasMany && <span className="viewer-count">{index + 1} / {variants.length}</span>}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasWhatsApp && (
            <a
              className="viewer-btn viewer-wa"
              href={whatsappLink(designEnquiry(productId, [current.variant_number]))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent(productId, 'whatsapp')}
              title={`Enquire about colour ${current.variant_number} on WhatsApp`}
            >
              <WhatsAppIcon size={20} />
            </a>
          )}
          <button
            className="viewer-btn"
            onClick={e => onDownload(e, getImageUrl(current.image_path))}
            title="Download image"
          >⬇</button>
          <button className="viewer-btn" onClick={close} title="Close">✕</button>
        </div>
      </div>

      {hasMany && (
        <>
          <button
            className="viewer-btn viewer-arrow prev"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            title="Previous colour"
          >‹</button>
          <button
            className="viewer-btn viewer-arrow next"
            onClick={() => goTo(index + 1)}
            disabled={index === variants.length - 1}
            title="Next colour"
          >›</button>
          <div className="viewer-dots">
            {variants.map((v, i) => (
              <span key={v.id} className={`viewer-dot${i === index ? ' active' : ''}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
