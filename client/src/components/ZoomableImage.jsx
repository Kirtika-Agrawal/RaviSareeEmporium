import { useState, useEffect, useRef } from 'react';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const RESET = { scale: 1, x: 0, y: 0, smooth: true };

export default function ZoomableImage({ src, alt, active, loading, onZoomChange, onBackgroundClick, onError }) {
  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const [view, setView] = useState(RESET);
  const viewRef = useRef(view);
  const mouseDrag = useRef(null);
  const lastTouchAt = useRef(0);

  const apply = (next) => {
    viewRef.current = next;
    setView(next);
  };

  // Stop panning once the image edge reaches the frame edge.
  const clamp = (scale, x, y, smooth = false) => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (scale <= 1 || !frame || !img) return { ...RESET, smooth };
    const maxX = Math.max(0, (img.offsetWidth * scale - frame.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * scale - frame.clientHeight) / 2);
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
      smooth,
    };
  };

  // Coordinates relative to the frame centre, which is where the image sits.
  const toFrame = (clientX, clientY) => {
    const r = frameRef.current.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  };

  // Zoom while keeping the point under the finger/cursor in place.
  const zoomAt = (p, scale, smooth = false) => {
    const cur = viewRef.current;
    const s = Math.min(MAX_SCALE, Math.max(1, scale));
    const k = s / cur.scale;
    apply(clamp(s, p.x - k * (p.x - cur.x), p.y - k * (p.y - cur.y), smooth));
  };

  const toggleAt = (p) => {
    if (viewRef.current.scale > 1) apply(RESET);
    else zoomAt(p, DOUBLE_TAP_SCALE, true);
  };

  useEffect(() => {
    if (!active) apply(RESET);
  }, [active]);

  const zoomed = view.scale > 1;
  useEffect(() => {
    if (active) onZoomChange(zoomed);
  }, [active, zoomed, onZoomChange]);

  // Touch and ctrl-wheel listeners must be non-passive to call preventDefault,
  // which React's own handlers can't do.
  useEffect(() => {
    const frame = frameRef.current;
    let gesture = null;
    let tapStart = null;
    let lastTap = null;

    const spread = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const midpoint = (a, b) => toFrame((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);

    const begin = (touches) => {
      const cur = viewRef.current;
      if (touches.length === 2) {
        gesture = { type: 'pinch', spread: spread(touches[0], touches[1]), mid: midpoint(touches[0], touches[1]), view: cur };
      } else if (touches.length === 1 && cur.scale > 1) {
        gesture = { type: 'pan', start: toFrame(touches[0].clientX, touches[0].clientY), view: cur };
      } else {
        // One finger, not zoomed: leave it to the track so the swipe works.
        gesture = null;
      }
    };

    const onTouchStart = (e) => {
      lastTouchAt.current = Date.now();
      begin(e.touches);
      tapStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };

    const onTouchMove = (e) => {
      if (!gesture) return;
      e.preventDefault();
      const g = gesture;
      if (g.type === 'pinch' && e.touches.length === 2) {
        const mid = midpoint(e.touches[0], e.touches[1]);
        const s = Math.min(MAX_SCALE, Math.max(1, g.view.scale * spread(e.touches[0], e.touches[1]) / g.spread));
        const k = s / g.view.scale;
        apply(clamp(s, mid.x - k * (g.mid.x - g.view.x), mid.y - k * (g.mid.y - g.view.y)));
      } else if (g.type === 'pan' && e.touches.length === 1) {
        const p = toFrame(e.touches[0].clientX, e.touches[0].clientY);
        apply(clamp(g.view.scale, g.view.x + p.x - g.start.x, g.view.y + p.y - g.start.y));
      }
    };

    const onTouchEnd = (e) => {
      // Lifting one finger of a pinch carries on as a pan with the other.
      if (e.touches.length > 0) {
        begin(e.touches);
        return;
      }
      gesture = null;
      const t = e.changedTouches[0];
      if (!tapStart || Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y) > 10) return;
      const now = Date.now();
      if (lastTap && now - lastTap.time < 300 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 40) {
        e.preventDefault();
        toggleAt(toFrame(t.clientX, t.clientY));
        lastTap = null;
      } else {
        lastTap = { time: now, x: t.clientX, y: t.clientY };
      }
    };

    const onTouchCancel = () => {
      gesture = null;
      tapStart = null;
    };

    // Trackpad pinch arrives as a wheel event with ctrlKey set.
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomAt(toFrame(e.clientX, e.clientY), viewRef.current.scale * Math.exp(-e.deltaY * 0.01));
    };

    frame.addEventListener('touchstart', onTouchStart, { passive: true });
    frame.addEventListener('touchmove', onTouchMove, { passive: false });
    frame.addEventListener('touchend', onTouchEnd, { passive: false });
    frame.addEventListener('touchcancel', onTouchCancel);
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      frame.removeEventListener('touchstart', onTouchStart);
      frame.removeEventListener('touchmove', onTouchMove);
      frame.removeEventListener('touchend', onTouchEnd);
      frame.removeEventListener('touchcancel', onTouchCancel);
      frame.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="viewer-zoom"
      onClick={e => e.target === e.currentTarget && !zoomed && onBackgroundClick()}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        draggable={false}
        onError={onError}
        onDoubleClick={e => {
          // Touch double-taps are handled above; ignore the emulated dblclick.
          if (Date.now() - lastTouchAt.current < 1000) return;
          toggleAt(toFrame(e.clientX, e.clientY));
        }}
        onPointerDown={e => {
          if (e.pointerType !== 'mouse' || viewRef.current.scale <= 1) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          mouseDrag.current = { x: e.clientX, y: e.clientY, view: viewRef.current };
        }}
        onPointerMove={e => {
          const d = mouseDrag.current;
          if (!d) return;
          apply(clamp(d.view.scale, d.view.x + e.clientX - d.x, d.view.y + e.clientY - d.y));
        }}
        onPointerUp={() => { mouseDrag.current = null; }}
        onPointerCancel={() => { mouseDrag.current = null; }}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transition: view.smooth ? 'transform 0.2s ease' : 'none',
          cursor: zoomed ? 'grab' : 'zoom-in',
        }}
      />
    </div>
  );
}
