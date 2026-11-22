import { useState, useEffect, useCallback } from 'react';
import { ToastProvider } from './hooks/useToast';
import { AdminProvider } from './hooks/useAdmin';
import HomePage, { rememberHomeScroll } from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import StatsPage from './pages/StatsPage';
import IdentifyPage from './pages/IdentifyPage';
import SideMenu from './components/SideMenu';
import { parseRoute, productPath, categoryPath, currentPath } from './utils/routes';
import { renameRecent } from './utils/recent';
import { shop } from './shop';

const PAGE_TITLES = { about: 'About', contact: 'Contact', stats: 'Stats', identify: 'Find by photo' };

export default function App() {
  const [route, setRoute] = useState(() => parseRoute());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // HomePage restores its own scroll position once its list has rendered.
    window.history.scrollRestoration = 'manual';
    const onPopState = () => {
      setMenuOpen(false);
      setRoute(parseRoute());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const label = route.page === 'product' ? `Design ${route.id}`
      : route.page === 'home' ? route.category
      : PAGE_TITLES[route.page];
    document.title = label ? `${label} · ${shop.name}` : shop.name;
  }, [route]);

  const navigate = (path) => {
    setMenuOpen(false);
    if (path === currentPath()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const next = parseRoute(path);
    if (route.page === 'home') rememberHomeScroll();
    window.history.pushState({ inApp: true }, '', path);
    setRoute(next);
    // Switching category from the menu keeps HomePage mounted, so it won't
    // reset its own scroll.
    if (route.page === 'home' && next.page === 'home') window.scrollTo(0, 0);
  };

  // Category buttons replace the entry rather than adding one, so Back still
  // leaves the catalogue instead of stepping through every tap.
  const setHomeCategory = (category) => {
    window.history.replaceState(window.history.state, '', categoryPath(category));
    setRoute({ page: 'home', category });
  };

  const goBack = () => {
    // Reached from inside the site: step back so Back/Forward stay in sync.
    // Opened from a shared link: there's nothing of ours behind this entry,
    // so replace it with the catalogue instead of leaving the site.
    if (window.history.state?.inApp) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', '/');
      setRoute({ page: 'home', category: null });
    }
  };

  const handleRenamed = (newId) => {
    renameRecent(route.id, newId);
    window.history.replaceState(window.history.state, '', productPath(newId));
    setRoute({ page: 'product', id: newId });
  };

  const openMenu = () => setMenuOpen(true);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <ToastProvider>
      <AdminProvider>
        {route.page === 'product' && (
          <ProductPage key={route.id} productId={route.id} onBack={goBack} onRenamed={handleRenamed} onMenu={openMenu} />
        )}
        {route.page === 'about' && <AboutPage onBack={goBack} onMenu={openMenu} navigate={navigate} />}
        {route.page === 'contact' && <ContactPage onBack={goBack} onMenu={openMenu} />}
        {route.page === 'stats' && (
          <StatsPage onBack={goBack} onMenu={openMenu} onSelectProduct={id => navigate(productPath(id))} />
        )}
        {route.page === 'identify' && (
          <IdentifyPage onBack={goBack} onMenu={openMenu} onSelectProduct={id => navigate(productPath(id))} />
        )}
        {route.page === 'home' && (
          <HomePage
            category={route.category}
            onCategoryChange={setHomeCategory}
            onSelectProduct={id => navigate(productPath(id))}
            onFindByPhoto={() => navigate('/identify')}
            onMenu={openMenu}
          />
        )}
        <SideMenu open={menuOpen} route={route} onClose={closeMenu} navigate={navigate} />
      </AdminProvider>
    </ToastProvider>
  );
}
