import { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import { getToken } from './auth';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!getToken());
  const location = useLocation();

  // Re-check auth on every route change (handles OAuth callback → dashboard)
  const checkAuth = useCallback(() => {
    setIsLoggedIn(!!getToken());
  }, [location.pathname]);

  // Trigger check on location change
  if (!isLoggedIn && getToken()) {
    setIsLoggedIn(true);
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<Login onLogin={checkAuth} />} />
      <Route path="/login" element={<Login onLogin={checkAuth} />} />
      <Route path="/" element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="/projects/:id" element={isLoggedIn ? <ProjectDetail /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
