import { useState } from 'react';
import { ToastProvider } from './hooks/useToast';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';

export default function App() {
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <ToastProvider>
      {selectedProduct ? (
        <ProductPage
          productId={selectedProduct}
          onBack={() => setSelectedProduct(null)}
        />
      ) : (
        <HomePage onSelectProduct={setSelectedProduct} />
      )}
    </ToastProvider>
  );
}
