import { useLayoutEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { WhatsAppIcon } from '../components/WhatsApp';
import { hasWhatsApp, whatsappLink, callLink, displayNumber, generalEnquiry } from '../utils/whatsapp';
import { shop } from '../shop';

const directionsUrl = shop.mapsUrl || (shop.address
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name}, ${shop.address.replace(/\n/g, ', ')}`)}`
  : '');

export default function ContactPage({ onBack, onMenu }) {
  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  const hasVisit = Boolean(shop.address || shop.hours);
  const hasAnything = hasWhatsApp || hasVisit || shop.instagram;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <PageHeader eyebrow={shop.name} title="Contact & Visit" onBack={onBack} onMenu={onMenu} />

      <div className="page-body info-page">
        {hasWhatsApp && (
          <section className="info-card">
            <h2>Talk to us</h2>
            <p className="muted">Send us a design number on WhatsApp and we'll reply with the price and availability.</p>
            <div className="info-actions">
              <a className="btn btn-wa" href={whatsappLink(generalEnquiry)} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon size={18} /> WhatsApp
              </a>
              <a className="btn btn-secondary" href={callLink}>Call {displayNumber}</a>
            </div>
          </section>
        )}

        {hasVisit && (
          <section className="info-card">
            <h2>Visit the shop</h2>
            {shop.address && <p className="address">{shop.address}</p>}
            {shop.hours && (
              <p>
                <span className="label" style={{ marginBottom: 2 }}>Opening hours</span>
                {shop.hours}
              </p>
            )}
            {directionsUrl && (
              <div className="info-actions">
                <a className="btn btn-primary" href={directionsUrl} target="_blank" rel="noopener noreferrer">
                  Get directions
                </a>
              </div>
            )}
          </section>
        )}

        {shop.instagram && (
          <section className="info-card">
            <h2>Follow us</h2>
            <a className="link-btn" href={`https://instagram.com/${shop.instagram}`} target="_blank" rel="noopener noreferrer">
              @{shop.instagram} on Instagram
            </a>
          </section>
        )}

        {!hasAnything && (
          <div className="empty-state">
            <h3>Contact details coming soon</h3>
            <p>Please check back shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
