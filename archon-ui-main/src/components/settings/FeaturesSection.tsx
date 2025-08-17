import React, { useState, useEffect } from 'react';
import { Moon, Sun, FileText, Layout, Bot, Settings, Palette, Flame, Monitor, Sparkles, Zap, Timer } from 'lucide-react';
import { Toggle } from '../ui/Toggle';
import { Card } from '../ui/Card';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { credentialsService } from '../../services/credentialsService';
import { useToast } from '../../contexts/ToastContext';
import { serverHealthService } from '../../services/serverHealthService';
import { getApiUrl } from '../../config/api';

export const FeaturesSection = () => {
  const {
    theme,
    setTheme
  } = useTheme();
  const {
    enableHighFidelityAnimations,
    setEnableHighFidelityAnimations,
    enableHighFrequencyPolling,
    setEnableHighFrequencyPolling,
    pollingInterval,
    setPollingInterval
  } = useSettings();
  const { showToast } = useToast();
  const isDarkMode = theme === 'dark';
  const [projectsEnabled, setProjectsEnabled] = useState(true);
  
  // Commented out for future release
  const [agUILibraryEnabled, setAgUILibraryEnabled] = useState(false);
  const [agentsEnabled, setAgentsEnabled] = useState(false);
  
  const [logfireEnabled, setLogfireEnabled] = useState(false);
  const [disconnectScreenEnabled, setDisconnectScreenEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [projectsSchemaValid, setProjectsSchemaValid] = useState(true);
  const [projectsSchemaError, setProjectsSchemaError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load both Logfire and Projects settings, plus check projects schema
      const [logfireResponse, projectsResponse, projectsHealthResponse, disconnectScreenRes] = await Promise.all([
        credentialsService.getCredential('LOGFIRE_ENABLED').catch(() => ({ value: undefined })),
        credentialsService.getCredential('PROJECTS_ENABLED').catch(() => ({ value: undefined })),
        fetch(`${getApiUrl()}/projects/health`).catch(() => null),
        credentialsService.getCredential('DISCONNECT_SCREEN_ENABLED').catch(() => ({ value: 'true' }))
      ]);
      
      // Set Logfire setting
      if (logfireResponse.value !== undefined) {
        setLogfireEnabled(logfireResponse.value === 'true');
      } else {
        setLogfireEnabled(false);
      }
      
      // Set Disconnect Screen setting
      setDisconnectScreenEnabled(disconnectScreenRes.value === 'true');
      
      // Check projects schema health
      console.log('🔍 Projects health response:', {
        response: projectsHealthResponse,
        ok: projectsHealthResponse?.ok,
        status: projectsHealthResponse?.status,
        url: `${getApiUrl()}/projects/health`
      });
      
      if (projectsHealthResponse && projectsHealthResponse.ok) {
        const healthData = await projectsHealthResponse.json();
        console.log('🔍 Projects health data:', healthData);
        
        const schemaValid = healthData.schema?.valid === true;
        setProjectsSchemaValid(schemaValid);
        
        if (!schemaValid) {
          setProjectsSchemaError(
            'Projects table not detected. Please ensure you have installed the archon_tasks.sql structure to your database and restart the server.'
          );
        } else {
          setProjectsSchemaError(null);
        }
      } else {
        // If health check fails, assume schema is invalid
        console.log('🔍 Projects health check failed');
        setProjectsSchemaValid(false);
        setProjectsSchemaError(
          'Unable to verify projects schema. Please ensure the backend is running and database is accessible.'
        );
      }
      
      // Set Projects setting (but only if schema is valid)
      if (projectsResponse.value !== undefined) {
        setProjectsEnabled(projectsResponse.value === 'true');
      } else {
        setProjectsEnabled(true); // Default to true
      }
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Default values on error
      setLogfireEnabled(false);
      setProjectsEnabled(true);
      setDisconnectScreenEnabled(true);
      setProjectsSchemaValid(false);
      setProjectsSchemaError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectsToggle = async (checked: boolean) => {
    // Prevent duplicate calls while one is already in progress
    if (loading) return;
    
    try {
      setLoading(true);
      // Update local state immediately for responsive UI
      setProjectsEnabled(checked);

      // Save to backend
      await credentialsService.createCredential({
        key: 'PROJECTS_ENABLED',
        value: checked.toString(),
        is_encrypted: false,
        category: 'features',
        description: 'Enable or disable Projects and Tasks functionality'
      });

      showToast(
        checked ? 'Projects Enabled Successfully!' : 'Projects Now Disabled', 
        checked ? 'success' : 'warning'
      );
    } catch (error) {
      console.error('Failed to update projects setting:', error);
      // Revert local state on error
      setProjectsEnabled(!checked);
      showToast('Failed to update Projects setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogfireToggle = async (checked: boolean) => {
    // Prevent duplicate calls while one is already in progress
    if (loading) return;
    
    try {
      setLoading(true);
      // Update local state immediately for responsive UI
      setLogfireEnabled(checked);

      // Save to backend
      await credentialsService.createCredential({
        key: 'LOGFIRE_ENABLED',
        value: checked.toString(),
        is_encrypted: false,
        category: 'monitoring',
        description: 'Enable or disable Pydantic Logfire logging and observability'
      });

      showToast(
        checked ? 'Logfire Enabled Successfully!' : 'Logfire Now Disabled', 
        checked ? 'success' : 'warning'
      );
    } catch (error) {
      console.error('Failed to update logfire setting:', error);
      // Revert local state on error
      setLogfireEnabled(!checked);
      showToast('Failed to update Logfire setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const handleDisconnectScreenToggle = async (checked: boolean) => {
    if (loading) return;
    
    try {
      setLoading(true);
      setDisconnectScreenEnabled(checked);

      await serverHealthService.updateSettings({ enabled: checked });

      showToast(
        checked ? 'Disconnect Screen Enabled' : 'Disconnect Screen Disabled',
        checked ? 'success' : 'warning'
      );
    } catch (error) {
      console.error('Failed to update disconnect screen setting:', error);
      setDisconnectScreenEnabled(!checked);
      showToast('Failed to update disconnect screen setting', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAnimationsToggle = (checked: boolean) => {
    setEnableHighFidelityAnimations(checked);
    showToast(
      checked ? 'High-Fidelity Animations Enabled' : 'High-Fidelity Animations Disabled',
      checked ? 'success' : 'warning'
    );
  };

  const handleHighFrequencyPollingToggle = (checked: boolean) => {
    setEnableHighFrequencyPolling(checked);
    showToast(
      checked ? 'High-Frequency Polling Enabled' : 'High-Frequency Polling Disabled',
      checked ? 'success' : 'warning'
    );
  };

  const handlePollingIntervalChange = (interval: number) => {
    setPollingInterval(interval);
    showToast(
      `Polling interval updated to ${interval / 1000}s`,
      'success'
    );
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
          {/* Theme Toggle */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm border border-purple-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                Dark Mode
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Switch between light and dark themes
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle checked={isDarkMode} onCheckedChange={handleThemeToggle} accentColor="purple" icon={isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />} />
            </div>
          </div>

          {/* Projects Toggle */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm border border-blue-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                Projects
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable Projects and Tasks functionality
              </p>
              {!projectsSchemaValid && projectsSchemaError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  ⚠️ {projectsSchemaError}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <Toggle
                checked={projectsEnabled}
                onCheckedChange={handleProjectsToggle}
                accentColor="blue"
                icon={<FileText className="w-5 h-5" />}
                disabled={loading || !projectsSchemaValid}
              />
            </div>
          </div>

          {/* High-Fidelity Animations Toggle */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 backdrop-blur-sm border border-cyan-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                High-Fidelity Animations
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable advanced visual effects and animations
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle
                checked={enableHighFidelityAnimations}
                onCheckedChange={handleAnimationsToggle}
                accentColor="cyan"
                icon={<Sparkles className="w-5 h-5" />}
              />
            </div>
          </div>

          {/* COMMENTED OUT FOR FUTURE RELEASE - AG-UI Library Toggle */}
          {/*
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-600/5 backdrop-blur-sm border border-pink-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                AG-UI Library
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable component library functionality
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle checked={agUILibraryEnabled} onCheckedChange={setAgUILibraryEnabled} accentColor="pink" icon={<Layout className="w-5 h-5" />} />
            </div>
          </div>
          */}

          {/* COMMENTED OUT FOR FUTURE RELEASE - Agents Toggle */}
          {/*
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm border border-green-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                Agents
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable AI agents for automated tasks
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle checked={agentsEnabled} onCheckedChange={setAgentsEnabled} accentColor="green" icon={<Bot className="w-5 h-5" />} />
            </div>
          </div>
          */}

          {/* Pydantic Logfire Toggle */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-sm border border-orange-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                Pydantic Logfire
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Structured logging and observability platform
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle 
                checked={logfireEnabled} 
                onCheckedChange={handleLogfireToggle} 
                accentColor="orange" 
                icon={<Flame className="w-5 h-5" />}
                disabled={loading}
              />
            </div>
          </div>

          {/* High-Frequency Polling Toggle */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm border border-yellow-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                High-Frequency Polling
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable frequent status updates (may impact performance)
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle
                checked={enableHighFrequencyPolling}
                onCheckedChange={handleHighFrequencyPollingToggle}
                accentColor="yellow"
                icon={<Zap className="w-5 h-5" />}
              />
            </div>
          </div>

          {/* Disconnect Screen Toggle */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm border border-green-500/20 shadow-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white">
                Disconnect Screen
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Show disconnect screen when server disconnects
              </p>
            </div>
            <div className="flex-shrink-0">
              <Toggle
                checked={disconnectScreenEnabled}
                onCheckedChange={handleDisconnectScreenToggle}
                accentColor="green"
                icon={<Monitor className="w-5 h-5" />}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Advanced Polling Settings */}
        {enableHighFrequencyPolling && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Timer className="w-5 h-5 text-blue-500" />
              Polling Configuration
            </h3>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm border border-blue-500/20 shadow-lg rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">
                    Polling Interval
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    How often to check for updates (5s - 300s)
                  </p>
                </div>
                <div className="text-sm font-mono text-blue-600 dark:text-blue-400">
                  {(pollingInterval / 1000).toFixed(0)}s
                </div>
              </div>
              <input
                type="range"
                min="5000"
                max="300000"
                step="5000"
                value={pollingInterval}
                onChange={(e) => handlePollingIntervalChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>5s</span>
                <span>Fast</span>
                <span>Balanced</span>
                <span>Conservative</span>
                <span>300s</span>
              </div>
            </div>
          </div>
        )}
    </>
  );
};
