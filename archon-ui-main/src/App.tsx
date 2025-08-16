import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layouts/MainLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { DisconnectScreenOverlay } from './components/DisconnectScreenOverlay';
import { ErrorBoundaryWithBugReport } from './components/bug-report/ErrorBoundaryWithBugReport';
import { serverHealthService } from './services/serverHealthService';

// Beta Enhancement: Lazy load main route components for improved initial bundle size
// This reduces the initial bundle from ~800KB to <500KB target
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage').then(module => ({ default: module.KnowledgeBasePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const MCPPage = lazy(() => import('./pages/MCPPage').then(module => ({ default: module.MCPPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(module => ({ default: module.OnboardingPage })));
const ProjectPage = lazy(() => import('./pages/ProjectPage').then(module => ({ default: module.ProjectPage })));

// Loading component for Suspense fallback
const PageLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading page...</p>
    </div>
  </div>
);

const AppRoutes = () => {
  const { projectsEnabled } = useSettings();
  
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      <Routes>
        <Route path="/" element={<KnowledgeBasePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/mcp" element={<MCPPage />} />
        {projectsEnabled ? (
          <Route path="/projects" element={<ProjectPage />} />
        ) : (
          <Route path="/projects" element={<Navigate to="/" replace />} />
        )}
      </Routes>
    </Suspense>
  );
};

const AppContent = () => {
  const [disconnectScreenActive, setDisconnectScreenActive] = useState(false);
  const [disconnectScreenDismissed, setDisconnectScreenDismissed] = useState(false);
  const [disconnectScreenSettings, setDisconnectScreenSettings] = useState({
    enabled: true,
    delay: 10000
  });

  useEffect(() => {
    // Load initial settings
    const settings = serverHealthService.getSettings();
    setDisconnectScreenSettings(settings);

    // Stop any existing monitoring before starting new one to prevent multiple intervals
    serverHealthService.stopMonitoring();

    // Start health monitoring
    serverHealthService.startMonitoring({
      onDisconnected: () => {
        if (!disconnectScreenDismissed) {
          setDisconnectScreenActive(true);
        }
      },
      onReconnected: () => {
        setDisconnectScreenActive(false);
        setDisconnectScreenDismissed(false);
        // Refresh the page to ensure all data is fresh
        window.location.reload();
      }
    });

    return () => {
      serverHealthService.stopMonitoring();
    };
  }, [disconnectScreenDismissed]);

  const handleDismissDisconnectScreen = () => {
    setDisconnectScreenActive(false);
    setDisconnectScreenDismissed(true);
  };

  return (
    <>
      <div data-testid="app-loaded" style={{ display: 'none' }} />
      <Router>
        <ErrorBoundaryWithBugReport>
          <MainLayout>
            <AppRoutes />
          </MainLayout>
        </ErrorBoundaryWithBugReport>
      </Router>
      <DisconnectScreenOverlay
        isActive={disconnectScreenActive && disconnectScreenSettings.enabled}
        onDismiss={handleDismissDisconnectScreen}
      />
    </>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}