import { useState, useEffect, useLayoutEffect } from 'react';
import PageHeader from '../components/PageHeader';
import StaffLoginModal from '../components/StaffLoginModal';
import { fetchStats, getImageUrl } from '../utils/api';
import { useAdmin } from '../hooks/useAdmin';

const PERIODS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 0, label: 'All time' },
];

const views = (n) => `${n} view${n === 1 ? '' : 's'}`;
const enquiries = (n) => `${n} ${n === 1 ? 'enquiry' : 'enquiries'}`;

export default function StatsPage({ onBack, onMenu, onSelectProduct }) {
  const { isAdmin, logout } = useAdmin();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setError('');
    fetchStats(days)
      .then(data => { if (!cancelled) setStats(data); })
      .catch(err => {
        if (cancelled) return;
        if (err.message === 'Unauthorized') logout();
        else setError(err.message);
      });
    return () => { cancelled = true; };
  }, [days, isAdmin, logout]);

  const totals = stats?.totals;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <PageHeader eyebrow="Staff" title="Stats" onBack={onBack} onMenu={onMenu} />

      <div className="page-body stats-page">
        {!isAdmin ? (
          <div className="empty-state">
            <h3>Staff only</h3>
            <p>Log in with the staff password to see which designs customers look at and enquire about.</p>
            <button className="btn btn-primary" onClick={() => setShowLogin(true)} style={{ marginTop: 20 }}>
              Staff login
            </button>
          </div>
        ) : (
          <>
            <div className="chip-row" role="toolbar" aria-label="Time period">
              {PERIODS.map(p => (
                <button
                  key={p.days}
                  className={`chip ${days === p.days ? 'active' : ''}`}
                  aria-pressed={days === p.days}
                  onClick={() => setDays(p.days)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {error && <p className="form-error">{error}</p>}
            {!stats && !error && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <div className="spinner" />
              </div>
            )}

            {totals && (
              <div className="stat-tiles">
                <div className="stat-tile">
                  <span className="stat-number">{totals.views}</span>
                  <span className="stat-label">Design views</span>
                </div>
                <div className="stat-tile">
                  <span className="stat-number">{totals.whatsapp}</span>
                  <span className="stat-label">WhatsApp taps</span>
                </div>
                <div className="stat-tile">
                  <span className="stat-number">{totals.calls}</span>
                  <span className="stat-label">Call taps</span>
                </div>
              </div>
            )}
            {totals && (
              <p className="stat-staff-line">
                Staff visits: <strong>{totals.staff_views}</strong>
                <span className="muted"> · design pages opened in staff mode, not included above</span>
              </p>
            )}

            {stats && stats.designs.length === 0 && (
              <div className="empty-state">
                <h3>Nothing counted yet</h3>
                <p>Views and enquiries are counted from when this page was added. Check back once customers have browsed for a while.</p>
              </div>
            )}

            {stats && stats.designs.length > 0 && (
              <section>
                <p className="menu-heading" style={{ padding: 0, margin: '24px 0 10px' }}>Top designs by enquiries</p>
                <ol className="stat-list">
                  {stats.designs.map(d => (
                    <li key={d.product_id}>
                      <button className="stat-row" onClick={() => onSelectProduct(d.product_id)}>
                        {d.first_image
                          ? <img src={getImageUrl(d.first_image)} alt="" loading="lazy" />
                          : <span className="stat-thumb-empty">🥻</span>}
                        <span className="stat-row-main">
                          <span className="stat-row-id">{d.product_id}</span>
                          {d.category && <span className="muted">{d.category}</span>}
                        </span>
                        <span className="stat-row-nums">
                          <strong>{enquiries(d.whatsapp + d.calls)}</strong>
                          <span className="muted">{views(d.views)}</span>
                          {d.staff_views > 0 && <span className="muted stat-staff">{d.staff_views} staff</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <p className="field-hint">Enquiries are taps on WhatsApp or Call from a design page. Views and enquiries are customers only; staff visits are listed separately.</p>
              </section>
            )}
          </>
        )}
      </div>

      {showLogin && <StaffLoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
