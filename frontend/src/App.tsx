import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import './App.css';

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const Verify = lazy(() => import('./pages/Verify').then((m) => ({ default: m.Verify })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));

function PageFallback() {
  return (
    <div className="fullscreen-loader ink-wash-bg">
      <div className="ink-pattern"></div>
      <div className="fullscreen-loader__panel animate-slideUp">
        <div className="fullscreen-loader__spinner"></div>
        <div className="fullscreen-loader__label">页面加载中...</div>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fullscreen-loader ink-wash-bg">
        <div className="ink-pattern"></div>
        <div className="fullscreen-loader__panel animate-slideUp">
          <div className="fullscreen-loader__spinner"></div>
          <div className="fullscreen-loader__label">正在同步控制台状态...</div>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fullscreen-loader ink-wash-bg">
        <div className="ink-pattern"></div>
        <div className="fullscreen-loader__panel animate-slideUp">
          <div className="fullscreen-loader__spinner"></div>
          <div className="fullscreen-loader__label">正在同步首页状态...</div>
        </div>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" /> : <Home />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/admin" element={<Admin />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
