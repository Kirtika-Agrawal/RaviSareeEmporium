export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Delete', danger = true }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
        </div>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          color: 'var(--gold)',
          fontSize: '1.4rem',
          textAlign: 'center',
          marginBottom: 12,
        }}>
          {title}
        </h2>
        <p style={{
          color: 'rgba(250,243,224,0.75)',
          fontSize: '0.95rem',
          textAlign: 'center',
          lineHeight: 1.6,
          marginBottom: 28,
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-gold'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
