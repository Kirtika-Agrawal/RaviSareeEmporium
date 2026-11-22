import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { fetchProducts, deleteProduct, getImageUrl } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAdmin } from '../hooks/useAdmin';
import AddProductModal from '../components/AddProductModal';
import ConfirmModal from '../components/ConfirmModal';
import BulkCategoryModal from '../components/BulkCategoryModal';
import TrashIcon from '../components/TrashIcon';
import StaffLoginModal from '../components/StaffLoginModal';
import { MenuButton } from '../components/SideMenu';
import { WhatsAppFab, useReserveBottom } from '../components/WhatsApp';
import { hasWhatsApp, generalEnquiry } from '../utils/whatsapp';
import { removeRecent } from '../utils/recent';
import { countCategories, rememberCategoryCounts } from '../utils/categories';

// Outlives HomePage while another page is open, so going back shows the same
// list, search and scroll position immediately while a fresh copy loads.
const homeCache = { products: null, search: '', scrollY: 0 };

export function rememberHomeScroll() {
  homeCache.scrollY = window.scrollY;
}

function SelectionBar({ count, total, onSelectAll, onCancel, onSetCategory }) {
  useReserveBottom(80);
  return (
    <div className="enquiry-bar">
      <div className="enquiry-bar-inner selection-bar">
        <div className="selection-info">
          <strong>{count} selected</strong>
          {count < total && (
            <button className="link-btn" onClick={onSelectAll}>Select all {total}</button>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={onSetCategory} disabled={count === 0}>
          Set category
        </button>
      </div>
    </div>
  );
}

export default function HomePage({ category, onCategoryChange, onSelectProduct, onMenu }) {
  const toast = useToast();
  const { isAdmin, logout } = useAdmin();
  const [products, setProducts] = useState(homeCache.products ?? []);
  const [loading, setLoading] = useState(!homeCache.products);
  const [search, setSearch] = useState(homeCache.search);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [imgErrors, setImgErrors] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showBulk, setShowBulk] = useState(false);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  // Leaving staff mode drops staff-only views without needing a reset.
  const selectMode = isAdmin && selecting;
  const untagged = isAdmin && untaggedOnly;

  useLayoutEffect(() => {
    if (homeCache.products) window.scrollTo(0, homeCache.scrollY);
  }, []);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const data = await fetchProducts(q);
      setProducts(data);
      homeCache.products = data;
      homeCache.search = q;
      if (!q) rememberCategoryCounts(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Handles both the initial load and search. Debounce only while typing, so
  // the first paint isn't held back by 300ms.
  useEffect(() => {
    const t = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleProductAdded = (product) => {
    load(search);
  };

  const handleDelete = async () => {
    try {
      await deleteProduct(deleteTarget.product_id);
      removeRecent(deleteTarget.product_id);
      toast(`Design ${deleteTarget.product_id} deleted`);
      setDeleteTarget(null);
      load(search);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const chips = countCategories(products);
  if (category && !chips.some(c => c.name === category)) chips.push({ name: category, count: 0 });
  const untaggedCount = products.filter(p => !p.category).length;
  const visible = untagged ? products.filter(p => !p.category)
    : category ? products.filter(p => p.category === category)
    : products;

  const showCategory = (name) => {
    setUntaggedOnly(false);
    onCategoryChange(name);
  };

  const showUntagged = () => {
    setUntaggedOnly(!untagged);
    if (category) onCategoryChange(null);
  };

  const toggleStaff = () => {
    if (!isAdmin) return setShowLogin(true);
    logout();
    toast('Staff mode off');
  };

  const toggleSelected = (id) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };

  const handleBulkDone = () => {
    setShowBulk(false);
    stopSelecting();
    load(search);
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <header className="page-header" style={{ padding: '22px 16px 16px', textAlign: 'center' }}>
        <div className="home-header-inner">
          <h1 className="brand-title">Ravi Saree Emporium</h1>
          <p className="brand-sub">{isAdmin ? 'Catalogue manager' : 'Saree collection'}</p>
          <div className="home-staff">
            <button
              className={`staff-btn${isAdmin ? ' on' : ''}`}
              onClick={toggleStaff}
              title={isAdmin ? 'Exit staff mode' : 'Staff login'}
            >
              <span className="staff-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={isAdmin ? 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.6-1.7' : 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4'} />
                </svg>
              </span>
              <span className="staff-label">{isAdmin ? 'Logout' : 'Login'}</span>
            </button>
          </div>
          <div className="home-menu"><MenuButton onClick={onMenu} /></div>
        </div>

        <div className="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            className="search-input"
            placeholder="Search by design number"
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
          />
        </div>
      </header>

      <div className="page-body">
        {(chips.length > 0 || (isAdmin && untaggedCount > 0)) && (
          <div className="chip-row" role="toolbar" aria-label="Browse by category">
            <button
              className={`chip ${!category && !untagged ? 'active' : ''}`}
              aria-pressed={!category && !untagged}
              onClick={() => showCategory(null)}
            >
              All <span className="chip-count">{products.length}</span>
            </button>
            {chips.map(c => (
              <button
                key={c.name}
                className={`chip ${!untagged && category === c.name ? 'active' : ''}`}
                aria-pressed={!untagged && category === c.name}
                onClick={() => showCategory(category === c.name ? null : c.name)}
              >
                {c.name} <span className="chip-count">{c.count}</span>
              </button>
            ))}
            {isAdmin && (untaggedCount > 0 || untagged) && (
              <button
                className={`chip chip-staff ${untagged ? 'active' : ''}`}
                aria-pressed={untagged}
                onClick={showUntagged}
                title="Staff only: designs without a category"
              >
                Untagged <span className="chip-count">{untaggedCount}</span>
              </button>
            )}
          </div>
        )}

        <div className="toolbar">
          <span className="muted">
            {visible.length} {untagged ? 'untagged ' : category ? `${category} ` : ''}{visible.length === 1 ? 'design' : 'designs'}
            {search && ` matching "${search}"`}
          </span>
          {isAdmin && !selectMode && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {visible.length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelecting(true)}
                  title="Select several designs to set their category"
                >
                  Select
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                + New Design
              </button>
            </div>
          )}
          {selectMode && <span className="muted">Tap designs to select them</span>}
        </div>

        {/* Loading — keep showing the current list while it refreshes */}
        {loading && products.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="empty-state fade-in">
            <span className="emoji">🥻</span>
            <h3>{search ? 'No designs found' : 'No designs yet'}</h3>
            <p>{search
              ? `No design number matches "${search}"`
              : isAdmin ? 'Add your first design to get started.' : 'New designs are coming soon.'
            }</p>
            {!search && isAdmin && (
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: 20 }}>
                + Add First Design
              </button>
            )}
          </div>
        )}

        {products.length > 0 && visible.length === 0 && (
          <div className="empty-state fade-in">
            {untagged ? (
              <>
                <h3>Every design has a category</h3>
                <p>{search ? `No untagged design matches "${search}".` : 'Nothing left to tag.'}</p>
              </>
            ) : (
              <>
                <h3>No {category} designs {search ? 'found' : 'yet'}</h3>
                <p>{search ? `Nothing in ${category} matches "${search}".` : 'Have a look at the rest of the collection.'}</p>
              </>
            )}
            <button className="btn btn-secondary" onClick={() => showCategory(null)} style={{ marginTop: 20 }}>
              Show all designs
            </button>
          </div>
        )}

        {visible.length > 0 && (
          <div className="products-grid">
            {visible.map((p, i) => (
              <div
                key={p.product_id}
                className={`card fade-in${selectMode ? ' selectable' : ''}${selectMode && selected.includes(p.product_id) ? ' selected' : ''}`}
                style={{ animationDelay: `${Math.min(i, 12) * 0.05}s` }}
                onClick={() => (selectMode ? toggleSelected(p.product_id) : onSelectProduct(p.product_id))}
                aria-pressed={selectMode ? selected.includes(p.product_id) : undefined}
              >
                <div className="card-photo">
                  {selectMode && <span className="select-check" aria-hidden="true">✓</span>}
                  {p.first_image && !imgErrors[p.product_id] ? (
                    <img
                      src={getImageUrl(p.first_image)}
                      alt={`Design ${p.product_id}`}
                      loading="lazy"
                      decoding="async"
                      onError={() => setImgErrors(prev => ({ ...prev, [p.product_id]: true }))}
                    />
                  ) : (
                    <div className="fallback">🥻</div>
                  )}
                  {isAdmin && !selectMode && (
                    <button
                      className="photo-action"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p); }}
                      title="Delete design"
                      aria-label={`Delete design ${p.product_id}`}
                    >
                      <TrashIcon size={17} />
                    </button>
                  )}
                </div>
                <h3 className="card-title">{p.product_id}</h3>
                <p className="card-meta">
                  {!category && p.category && `${p.category} · `}
                  {p.variant_count} colour{p.variant_count !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectMode ? (
        <SelectionBar
          count={selected.length}
          total={visible.length}
          onSelectAll={() => setSelected(visible.map(p => p.product_id))}
          onCancel={stopSelecting}
          onSetCategory={() => setShowBulk(true)}
        />
      ) : (
        hasWhatsApp && <WhatsAppFab message={generalEnquiry} />
      )}

      {showLogin && <StaffLoginModal onClose={() => setShowLogin(false)} />}

      {showBulk && (
        <BulkCategoryModal
          productIds={selected}
          onClose={() => setShowBulk(false)}
          onDone={handleBulkDone}
        />
      )}

      {showAddModal && (
        <AddProductModal
          defaultCategory={category}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleProductAdded}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`Delete Design ${deleteTarget.product_id}?`}
          message={`This permanently deletes the design with its ${deleteTarget.variant_count} colour${deleteTarget.variant_count === 1 ? '' : 's'} and photos. This cannot be undone.`}
          confirmLabel="Delete Design"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
