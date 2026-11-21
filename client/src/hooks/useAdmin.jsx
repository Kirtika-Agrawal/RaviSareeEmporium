import { createContext, useContext, useState, useCallback } from 'react';
import { setAdminPassword, getAdminPassword } from '../utils/api';

const AdminContext = createContext(null);

// Staff mode only controls which buttons are shown. Every write is still
// checked against the password on the server.
export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(() => !!getAdminPassword());

  const login = useCallback((password) => {
    setAdminPassword(password);
    setIsAdmin(true);
  }, []);

  const logout = useCallback(() => {
    setAdminPassword('');
    setIsAdmin(false);
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
