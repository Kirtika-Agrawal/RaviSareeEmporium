import { useState } from 'react';
import { ToastProvider } from './hooks/useToast';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import { setAdminPassword, getAdminPassword } from './utils/api';

export default function App() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [password, setPassword] = useState(getAdminPassword());
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const pwd = e.target.password.value;
    setAdminPassword(pwd);
    setPassword(pwd);
    setShowPasswordInput(false);
  };

  return (
    <ToastProvider>
      {/* Small lock button in corner */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 999 }}>
        {!showPasswordInput ? (
          <button
            onClick={() => setShowPasswordInput(true)}
            style={{
              background: password ? '#2ecc71' : 'rgba(201,168,76,0.2)',
              border: '1px solid rgba(201,168,76,0.4)',
              borderRadius: '50%',
              width: 44,
              height: 44,
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
            title={password ? 'Admin mode active' : 'Enter admin password'}
          >
            {password ? '🔓' : '🔒'}
          </button>
        ) : (
          <form
            onSubmit={handlePasswordSubmit}
            style={{
              background: 'rgba(61,13,24,0.98)',
              border: '1px solid rgba(201,168,76,0.4)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: 200,
            }}
          >
            <input
              name="password"
              type="password"
              placeholder="Enter admin password"
              className="input"
              autoFocus
              style={{ fontSize: '0.9rem' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-gold" style={{ flex: 1, padding: '8px' }}>
                Unlock
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowPasswordInput(false)}
                style={{ padding: '8px' }}
              >
                ✕
              </button>
            </div>
          </form>
        )}
      </div>

      {selectedProduct ? (
        <ProductPage productId={selectedProduct} onBack={() => setSelectedProduct(null)} />
      ) : (
        <HomePage onSelectProduct={setSelectedProduct} />
      )}
    </ToastProvider>
  );
}
