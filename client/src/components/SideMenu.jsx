import { useState, useEffect } from 'react';
import { useAdmin } from '../hooks/useAdmin';
import { useToast } from '../hooks/useToast';
import { fetchProducts, getImageUrl } from '../utils/api';
import { getRecent } from '../utils/recent';
import { productPath, categoryPath } from '../utils/routes';
import { knownCategoryCounts, rememberCategoryCounts } from '../utils/categories';
import { hasWhatsApp, whatsappLink, callLink, generalEnquiry } from '../utils/whatsapp';
import { shop } from '../shop';
import { WhatsAppIcon } from './WhatsApp';

const ICONS = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  camera: 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  tag: 'M3 12.5V4h8.5L21 13.5 13.5 21 3 12.5zM7.5 8v.01',
};

function Icon({ name }) {
  return (
    <svg className="menu-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function MenuButton({ onClick }) {
  return (
    <button className="menu-btn" onClick={onClick} aria-label="Open menu" title="Menu">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>
  );
}

export default function SideMenu({ open, route, onClose, navigate }) {
  const { isAdmin } = useAdmin();
  const toast = useToast();
  const [recent, setRecent] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brokenImages, setBrokenImages] = useState({});
  const page = route.page;
  const activeCategory = page === 'home' ? route.category : null;

  useEffect(() => {
    if (!open) return;
    setRecent(getRecent());
    const known = knownCategoryCounts();
    if (known) {
      setCategories(known);
    } else {
      // Opened before the catalogue loaded, e.g. straight from a shared link.
      fetchProducts()
        .then(products => {
          rememberCategoryCounts(products);
          setCategories(knownCategoryCounts());
        })
        .catch(() => {});
    }
    const onKey = (e) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const share = async () => {
    const url = window.location.origin;
    onClose();
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.name, text: `Have a look at the ${shop.name} saree collection`, url });
      } catch {
        // Closing the share sheet rejects; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast(url, 'info');
    }
  };

  const navItem = (target, active, icon, label) => (
    <button
      className={`menu-item ${active ? 'active' : ''}`}
      onClick={() => navigate(target)}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={icon} /> {label}
    </button>
  );

  const visibleRecent = recent.filter(r => !brokenImages[r.id]);

  return (
    <>
      <div className={`menu-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`side-menu ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Menu">
        <div className="side-menu-head">
          <div>
            <p className="side-menu-title">{shop.name}</p>
            <p className="brand-sub">Saree collection</p>
          </div>
          <button className="menu-btn" onClick={onClose} aria-label="Close menu">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="side-menu-body">
          <nav className="menu-group">
            {navItem('/', page === 'home' && !activeCategory, 'home', 'All designs')}
            {navItem('/about', page === 'about', 'info', 'About us')}
            {navItem('/contact', page === 'contact', 'pin', 'Contact & visit')}
            {isAdmin && navItem('/identify', page === 'identify', 'camera', 'Find by photo (staff)')}
            {isAdmin && navItem('/stats', page === 'stats', 'chart', 'Stats (staff)')}
          </nav>

          {categories.length > 0 && (
            <nav className="menu-group" aria-label="Browse by category">
              <p className="menu-heading">Browse by category</p>
              {categories.map(c => (
                <button
                  key={c.name}
                  className={`menu-item ${activeCategory === c.name ? 'active' : ''}`}
                  onClick={() => navigate(categoryPath(c.name))}
                  aria-current={activeCategory === c.name ? 'page' : undefined}
                >
                  <Icon name="tag" /> {c.name}
                  <span className="menu-count">{c.count}</span>
                </button>
              ))}
            </nav>
          )}

          {visibleRecent.length > 0 && (
            <section className="menu-group">
              <p className="menu-heading">Recently viewed</p>
              <div className="recent-row">
                {visibleRecent.map(r => (
                  <button key={r.id} className="recent-item" onClick={() => navigate(productPath(r.id))}>
                    <img
                      src={getImageUrl(r.image)}
                      alt=""
                      loading="lazy"
                      onError={() => setBrokenImages(prev => ({ ...prev, [r.id]: true }))}
                    />
                    <span>{r.id}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="menu-group">
            {hasWhatsApp && <p className="menu-heading">Get in touch</p>}
            {hasWhatsApp && (
              <a className="menu-item" href={whatsappLink(generalEnquiry)} target="_blank" rel="noopener noreferrer">
                <span className="menu-icon wa"><WhatsAppIcon size={18} /></span> WhatsApp us
              </a>
            )}
            {hasWhatsApp && (
              <a className="menu-item" href={callLink}>
                <Icon name="phone" /> Call us
              </a>
            )}
            <button className="menu-item" onClick={share}>
              <Icon name="share" /> Share this catalogue
            </button>
          </section>
        </div>

      </aside>
    </>
  );
}
