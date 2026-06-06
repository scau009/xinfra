import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import { getToken } from './auth';

export default function App() {
  const isLoggedIn = !!getToken();

  return (
    <Routes>
      <Route path="/auth/callback" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/projects/:id" element={isLoggedIn ? <ProjectDetail /> : <Navigate to="/login" />} />
    </Routes>
  );
}
