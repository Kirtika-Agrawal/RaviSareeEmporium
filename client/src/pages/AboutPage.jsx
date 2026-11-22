import { useLayoutEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { hasWhatsApp } from '../utils/whatsapp';
import { shop } from '../shop';

export default function AboutPage({ onBack, onMenu, navigate }) {
  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <PageHeader eyebrow={shop.name} title="About Us" onBack={onBack} onMenu={onMenu} />

      <div className="page-body info-page">
        {shop.about.length > 0 && (
          <section className="info-section">
            {shop.about.map((para, i) => <p key={i}>{para}</p>)}
          </section>
        )}

        <section className="info-section">
          <h2>How to enquire</h2>
          <ol className="steps">
            <li>
              <strong>Browse the designs.</strong> Tap a photo to see it full screen, and pinch or double-tap to zoom in on the work.
            </li>
            <li>
              <strong>Pick your colours.</strong> Most designs come in several colours. Tap Select on the ones you like.
            </li>
            {hasWhatsApp ? (
              <li>
                <strong>Enquire on WhatsApp.</strong> Your message already names the design and colours, and we reply with the price and availability.
              </li>
            ) : (
              <li>
                <strong>Get in touch.</strong> Call or visit us with the design number for the price and availability.
              </li>
            )}
          </ol>
          <p className="muted">Prices are shared on request.</p>
        </section>

        <div className="info-actions">
          <button className="btn btn-primary" onClick={() => navigate('/')}>Browse designs</button>
          <button className="btn btn-secondary" onClick={() => navigate('/contact')}>Contact &amp; visit</button>
        </div>
      </div>
    </div>
  );
}
