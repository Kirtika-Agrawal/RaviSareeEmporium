import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import PageHeader from '../components/PageHeader';
import StaffLoginModal from '../components/StaffLoginModal';
import { fetchCustomers, addCustomer, updateCustomer } from '../utils/api';
import { formatPhone } from '../utils/whatsapp';
import { useAdmin } from '../hooks/useAdmin';
import { useToast } from '../hooks/useToast';

// The database stores UTC as "YYYY-MM-DD HH:MM:SS".
const parseTime = (value) => (value ? new Date(`${value.replace(' ', 'T')}Z`) : null);

function timeAgo(value) {
  const date = parseTime(value);
  if (!date) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const DONE_MESSAGES = {
  approve: name => `${name} can now see the catalogue`,
  reject: name => `Request from ${name} removed`,
  block: name => `${name} is blocked and logged out`,
  unblock: name => `${name} can see the catalogue again`,
};

export default function CustomersPage({ onBack, onMenu, requestId }) {
  const { isAdmin, logout } = useAdmin();
  const toast = useToast();
  const [showLogin, setShowLogin] = useState(false);
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);

  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  const load = useCallback(async () => {
    try {
      setCustomers(await fetchCustomers());
      setError('');
    } catch (err) {
      if (err.message === 'Unauthorized') logout();
      else setError(err.message);
    }
  }, [logout]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const act = async (customer, action) => {
    setBusyId(customer.id);
    try {
      await updateCustomer(customer.id, action);
      toast(DONE_MESSAGES[action](customer.name), 'success');
      setBlockTarget(null);
      await load();
    } catch (err) {
      if (err.message === 'Unauthorized') logout();
      else toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const customer = await addCustomer(newName, newPhone);
      toast(`${customer.name} can now see the catalogue`, 'success');
      setNewName('');
      setNewPhone('');
      setShowAdd(false);
      await load();
    } catch (err) {
      if (err.message === 'Unauthorized') logout();
      else toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const pending = customers?.filter(c => c.status === 'pending') ?? [];
  const approved = customers?.filter(c => c.status === 'approved') ?? [];
  const blocked = customers?.filter(c => c.status === 'blocked') ?? [];
  const requested = requestId && customers ? customers.find(c => c.id === requestId) : null;

  const pendingRow = (c, highlight) => (
    <li key={c.id} className={`customer-row${highlight ? ' customer-highlight' : ''}`}>
      <div className="customer-info">
        <strong>{c.name}</strong>
        <span>{formatPhone(c.phone)} · asked {timeAgo(c.created_at)}</span>
        {highlight && (
          <p className="customer-check">
            Approve only if the WhatsApp message came from <strong>{formatPhone(c.phone)}</strong>.
          </p>
        )}
      </div>
      <div className="customer-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => act(c, 'reject')} disabled={busyId === c.id}>
          Reject
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => act(c, 'approve')} disabled={busyId === c.id}>
          Approve
        </button>
      </div>
    </li>
  );

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 60 }}>
      <PageHeader eyebrow="Staff" title="Customers" onBack={onBack} onMenu={onMenu} />

      <div className="page-body customers-page">
        {!isAdmin ? (
          <div className="empty-state">
            <h3>Staff only</h3>
            <p>Log in with the staff password to approve customers.</p>
            <button className="btn btn-primary" onClick={() => setShowLogin(true)} style={{ marginTop: 20 }}>
              Staff login
            </button>
          </div>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : !customers ? (
          <div className="login-waiting"><div className="spinner" /></div>
        ) : (
          <>
            {requestId && !requested && (
              <p className="identify-note">That request was already handled, or the person asked again with a new request.</p>
            )}
            {requested && requested.status !== 'pending' && (
              <p className="identify-note">
                {requested.name} ({formatPhone(requested.phone)}) is already {requested.status}.
              </p>
            )}

            <section className="customers-section">
              <h2 className="customers-heading">Waiting for approval</h2>
              {pending.length === 0 ? (
                <p className="customers-empty">No requests waiting.</p>
              ) : (
                <ul className="customers-list">
                  {pending
                    .slice()
                    .sort((a, b) => (b.id === requestId) - (a.id === requestId))
                    .map(c => pendingRow(c, c.id === requestId))}
                </ul>
              )}
            </section>

            <section className="customers-section">
              <div className="customers-heading-row">
                <h2 className="customers-heading">Can see the catalogue ({approved.length})</h2>
                {!showAdd && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAdd(true)}>+ Add</button>
                )}
              </div>
              {showAdd && (
                <form className="customer-add" onSubmit={add}>
                  <input className="input" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
                  <input className="input" type="tel" placeholder="WhatsApp number" value={newPhone} onChange={e => setNewPhone(e.target.value)} required />
                  <div className="customer-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
                      {adding ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                  <p className="field-hint">They'll get straight in when they enter this number on the login page.</p>
                </form>
              )}
              {approved.length === 0 ? (
                <p className="customers-empty">Nobody yet.</p>
              ) : (
                <ul className="customers-list">
                  {approved.map(c => (
                    <li key={c.id} className="customer-row">
                      <div className="customer-info">
                        <strong>{c.name}</strong>
                        <span>{formatPhone(c.phone)}</span>
                        <span>
                          {c.last_seen ? `Last visit ${timeAgo(c.last_seen)}` : 'Not logged in on any phone'}
                          {c.devices > 1 ? ` · on ${c.devices} phones or browsers` : ''}
                        </span>
                      </div>
                      <div className="customer-actions">
                        <button className="btn btn-danger-text btn-sm" onClick={() => setBlockTarget(c)} disabled={busyId === c.id}>
                          Block
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {blocked.length > 0 && (
              <section className="customers-section">
                <h2 className="customers-heading">Blocked ({blocked.length})</h2>
                <ul className="customers-list">
                  {blocked.map(c => (
                    <li key={c.id} className="customer-row">
                      <div className="customer-info">
                        <strong>{c.name}</strong>
                        <span>{formatPhone(c.phone)}</span>
                      </div>
                      <div className="customer-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => act(c, 'unblock')} disabled={busyId === c.id}>
                          Unblock
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {blockTarget && (
        <div className="modal-overlay" onClick={() => setBlockTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h2 className="modal-title">Block {blockTarget.name}?</h2>
            </div>
            <p className="modal-text" style={{ marginBottom: 20 }}>
              {formatPhone(blockTarget.phone)} will be logged out on every phone straight away and can't ask for access
              again unless you unblock them.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setBlockTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => act(blockTarget, 'block')} disabled={busyId === blockTarget.id}>
                Block
              </button>
            </div>
          </div>
        </div>
      )}
      {showLogin && <StaffLoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
