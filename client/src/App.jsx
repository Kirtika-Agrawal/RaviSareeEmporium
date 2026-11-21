import { useState, useEffect } from 'react';
import { ToastProvider } from './hooks/useToast';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';

const productPath = (id) => `/product/${encodeURIComponent(id)}`;

const productIdFromPath = () => {
  const match = window.location.pathname.match(/^\/product\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
};

export default function App() {
  const [selectedProduct, setSelectedProduct] = useState(productIdFromPath);

  useEffect(() => {
    // HomePage restores its own scroll position once its list has rendered.
    window.history.scrollRestoration = 'manual';
    const onPopState = () => setSelectedProduct(productIdFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openProduct = (id) => {
    window.history.pushState({ fromHome: true }, '', productPath(id));
    setSelectedProduct(id);
  };

  const goHome = () => {
    // Opened from the catalogue: step back so Back/Forward stay in sync.
    // Opened from a shared link: there's no catalogue entry behind us, so
    // replace this one instead of leaving the site.
    if (window.history.state?.fromHome) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', '/');
      setSelectedProduct(null);
    }
  };

  const handleRenamed = (newId) => {
    window.history.replaceState(window.history.state, '', productPath(newId));
    setSelectedProduct(newId);
  };

  return (
    <ToastProvider>
      {selectedProduct ? (
        <ProductPage productId={selectedProduct} onBack={goHome} onRenamed={handleRenamed} />
      ) : (
        <HomePage onSelectProduct={openProduct} />
      )}
    </ToastProvider>
  );
}
