import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAccessToken, setAccessToken, requestAccess, fetchMyAccess, logoutAccess } from '../utils/api';

const AccessContext = createContext(null);

// How often a waiting customer's page asks whether staff have approved them.
const POLL_MS = 5000;

// status: 'checking' | 'none' | 'pending' | 'approved' | 'error'
export function AccessProvider({ children }) {
  const [state, setState] = useState(() => ({
    status: getAccessToken() ? 'checking' : 'none',
    customer: null,
  }));

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setState({ status: 'none', customer: null });
      return;
    }
    try {
      const customer = await fetchMyAccess();
      if (customer) {
        setState({ status: customer.status, customer });
      } else {
        setAccessToken('');
        setState({ status: 'none', customer: null });
      }
    } catch {
      // Offline or the server is down. Keep a known status rather than
      // logging someone out over a bad connection.
      setState(prev => (prev.status === 'checking' ? { status: 'error', customer: null } : prev));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (state.status !== 'pending') return undefined;
    const check = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(check, POLL_MS);
    // Coming back from WhatsApp should show the approval straight away.
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [state.status, refresh]);

  const request = useCallback(async (name, phone) => {
    const { token, customer } = await requestAccess(name, phone);
    setAccessToken(token);
    setState({ status: customer.status, customer });
    return customer;
  }, []);

  const logout = useCallback(async () => {
    await logoutAccess();
    setState({ status: 'none', customer: null });
  }, []);

  return (
    <AccessContext.Provider value={{ ...state, refresh, request, logout }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  return useContext(AccessContext);
}
