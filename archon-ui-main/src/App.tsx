import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layouts/MainLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { DisconnectScreenOverlay } from './components/DisconnectScreenOverlay';
import { ErrorBoundaryWithBugReport } from './components/bug-report/ErrorBoundaryWithBugReport';
import { serverHealthService } from './services/serverHealthService';

// Runtime console policy to control verbosity via Vite env
// Usage:
// - VITE_LOG_LEVEL: "silent" | "error" | "warn" | "info" | "debug" (default: "debug" in dev, "warn" in prod)
// - VITE_ENABLE_VERBOSE_LOGS: "true" to bypass filtering (useful for debugging sessions)
// Force log any message by prefixing first arg with "[FORCE]"
type ConsoleMethod = 'error' | 'warn' | 'info' | 'log' | 'debug';
const ARCHON_LOG_LEVEL =
  (import.meta.env.VITE_LOG_LEVEL ?? (import.meta.env.MODE === 'production' ? 'warn' : 'debug')).toLowerCase();
const ARCHON_VERBOSE_LOGS = import.meta.env.VITE_ENABLE_VERBOSE_LOGS === 'true';

(function installConsolePolicy() {
  if (ARCHON_VERBOSE_LOGS) return;

  const levelOrder: Record<string, number> = { silent: 0, error: 1, warn: 2, info: 3, log: 3, debug: 4 };
  const current = levelOrder[ARCHON_LOG_LEVEL] ?? 2; // default to 'warn'

  const patch = (method: ConsoleMethod, minLevel: number) => {
    const original = (console as any)[method].bind(console);
    (console as any)[method] = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith('[FORCE]')) {
        return original(...args);
      }
      if (current >= minLevel) {
        return original(...args);
      }
      // suppressed
    };
  };

  // error:1, warn:2, info/log:3, debug:4
  patch('error', 1);
  patch('warn', 2);
  patch('info', 3);
  patch('log', 3);
  patch('debug', 4);
})();

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