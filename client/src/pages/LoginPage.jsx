import { useState } from 'react';
import StaffLoginModal from '../components/StaffLoginModal';
import { WhatsAppIcon } from '../components/WhatsApp';
import { useAccess } from '../hooks/useAccess';
import { hasWhatsApp, whatsappLink, displayNumber, formatPhone } from '../utils/whatsapp';
import { shop } from '../shop';

function requestMessage(customer) {
  const approveLink = `${window.location.origin}/customers?request=${customer.id}`;
  return `Hi ${shop.name}, I'd like to see your catalogue.\n`
    + `Name: ${customer.name}\nPhone: ${formatPhone(customer.phone)}\n\n`
    + `Staff, approve here: ${approveLink}`;
}

export default function LoginPage() {
  const access = useAccess();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showStaffLogin, setShowStaffLogin] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await access.request(name, phone);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  let body;
  if (access.status === 'checking') {
    body = (
      <div className="login-waiting">
        <div className="spinner" />
        <p>Opening the catalogue...</p>
      </div>
    );
  } else if (access.status === 'error') {
    body = (
      <>
        <h2 className="login-title">Couldn't reach the catalogue</h2>
        <p className="login-text">Check your internet connection and try again.</p>
        <button className="btn btn-primary login-wide" onClick={access.refresh}>Try again</button>
      </>
    );
  } else if (access.status === 'pending') {
    body = (
      <>
        <h2 className="login-title">Almost there</h2>
        {hasWhatsApp ? (
          <>
            <p className="login-text">
              Send your request to the shop on WhatsApp. This page opens by itself once they approve you.
            </p>
            <a
              className="btn btn-wa login-wide"
              href={whatsappLink(requestMessage(access.customer))}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={18} /> Send request on WhatsApp
            </a>
          </>
        ) : (
          <p className="login-text">
            Ask the shop to approve request number {access.customer.id}. This page opens by itself once they do.
          </p>
        )}
        <div className="login-waiting">
          <span className="spinner spinner-sm" />
          <p>Waiting for approval for {formatPhone(access.customer.phone)}</p>
        </div>
        <button className="link-btn" onClick={access.logout}>Not you? Use a different number</button>
      </>
    );
  } else {
    body = (
      <form onSubmit={submit} className="login-form">
        <h2 className="login-title">This catalogue is private</h2>
        <p className="login-text">Enter your name and WhatsApp number to ask the shop for access.</p>
        <div>
          <label className="label" htmlFor="login-name">Your name</label>
          <input
            id="login-name"
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
            maxLength={60}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="login-phone">WhatsApp number</label>
          <input
            id="login-phone"
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="98765 43210"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary login-wide" type="submit" disabled={sending}>
          {sending && <span className="spinner spinner-sm" />}
          {sending ? 'Sending...' : 'Request access'}
        </button>
        <p className="login-small">Already approved on another phone? Enter the same number to get straight in.</p>
      </form>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <h1 className="brand-title">{shop.name}</h1>
          <p className="brand-sub">Saree collection</p>
        </div>
        {body}
      </div>
      <div className="login-footer">
        {hasWhatsApp && <p>Questions? WhatsApp {displayNumber}</p>}
        <button className="link-btn" onClick={() => setShowStaffLogin(true)}>Staff login</button>
      </div>
      {showStaffLogin && <StaffLoginModal onClose={() => setShowStaffLogin(false)} />}
    </div>
  );
}
