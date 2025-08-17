import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { credentialsService } from '../services/credentialsService';

interface SettingsContextType {
  projectsEnabled: boolean;
  setProjectsEnabled: (enabled: boolean) => void;
  enableHighFidelityAnimations: boolean;
  setEnableHighFidelityAnimations: (enabled: boolean) => void;
  enableHighFrequencyPolling: boolean;
  setEnableHighFrequencyPolling: (enabled: boolean) => void;
  pollingInterval: number;
  setPollingInterval: (interval: number) => void;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [projectsEnabled, setProjectsEnabledState] = useState(true);
  const [enableHighFidelityAnimations, setEnableHighFidelityAnimationsState] = useState(true);
  const [enableHighFrequencyPolling, setEnableHighFrequencyPollingState] = useState(false);
  const [pollingInterval, setPollingIntervalState] = useState(30000); // Default 30 seconds
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load Projects setting
      const projectsResponse = await credentialsService.getCredential('PROJECTS_ENABLED').catch(() => ({ value: undefined }));
      
      if (projectsResponse.value !== undefined) {
        setProjectsEnabledState(projectsResponse.value === 'true');
      } else {
        setProjectsEnabledState(true); // Default to true
      }

      // Load Animations setting
      const animationsResponse = await credentialsService.getCredential('HIGH_FIDELITY_ANIMATIONS_ENABLED').catch(() => ({ value: undefined }));

      if (animationsResponse.value !== undefined) {
        setEnableHighFidelityAnimationsState(animationsResponse.value === 'true');
      } else {
        setEnableHighFidelityAnimationsState(true); // Default to true
      }

      // Load High Frequency Polling setting
      const pollingResponse = await credentialsService.getCredential('HIGH_FREQUENCY_POLLING_ENABLED').catch(() => ({ value: undefined }));

      if (pollingResponse.value !== undefined) {
        setEnableHighFrequencyPollingState(pollingResponse.value === 'true');
      } else {
        setEnableHighFrequencyPollingState(false); // Default to false for performance
      }

      // Load Polling Interval setting
      const intervalResponse = await credentialsService.getCredential('POLLING_INTERVAL_MS').catch(() => ({ value: undefined }));

      if (intervalResponse.value !== undefined) {
        const interval = parseInt(intervalResponse.value);
        setPollingIntervalState(isNaN(interval) ? 30000 : interval);
      } else {
        setPollingIntervalState(30000); // Default to 30 seconds
      }
      
    } catch (error) {
      console.error('Failed to load settings:', error);
      setProjectsEnabledState(true);
      setEnableHighFidelityAnimationsState(true);
      setEnableHighFrequencyPollingState(false);
      setPollingIntervalState(30000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const setProjectsEnabled = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setProjectsEnabledState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: 'PROJECTS_ENABLED',
        value: enabled.toString(),
        is_encrypted: false,
        category: 'features',
        description: 'Enable or disable Projects and Tasks functionality'
      });
    } catch (error) {
      console.error('Failed to update projects setting:', error);
      // Revert on error
      setProjectsEnabledState(!enabled);
      throw error;
    }
  };

  const setEnableHighFidelityAnimations = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setEnableHighFidelityAnimationsState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: 'HIGH_FIDELITY_ANIMATIONS_ENABLED',
        value: enabled.toString(),
        is_encrypted: false,
        category: 'features',
        description: 'Enable or disable high fidelity animations to improve performance'
      });
    } catch (error) {
      console.error('Failed to update animations setting:', error);
      // Revert on error
      setEnableHighFidelityAnimationsState(!enabled);
      throw error;
    }
  };

  const setEnableHighFrequencyPolling = async (enabled: boolean) => {
    try {
      // Update local state immediately
      setEnableHighFrequencyPollingState(enabled);

      // Save to backend
      await credentialsService.createCredential({
        key: 'HIGH_FREQUENCY_POLLING_ENABLED',
        value: enabled.toString(),
        is_encrypted: false,
        category: 'performance',
        description: 'Enable high frequency polling for real-time updates (may impact performance)'
      });
    } catch (error) {
      console.error('Failed to update polling setting:', error);
      // Revert on error
      setEnableHighFrequencyPollingState(!enabled);
      throw error;
    }
  };

  const setPollingInterval = async (interval: number) => {
    try {
      // Validate interval (minimum 5 seconds, maximum 5 minutes)
      const validInterval = Math.min(Math.max(interval, 5000), 300000);
      
      // Update local state immediately
      setPollingIntervalState(validInterval);

      // Save to backend
      await credentialsService.createCredential({
        key: 'POLLING_INTERVAL_MS',
        value: validInterval.toString(),
        is_encrypted: false,
        category: 'performance',
        description: 'Polling interval in milliseconds for status updates'
      });
    } catch (error) {
      console.error('Failed to update polling interval:', error);
      // Revert on error
      setPollingIntervalState(30000);
      throw error;
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  const value: SettingsContextType = {
    projectsEnabled,
    setProjectsEnabled,
    enableHighFidelityAnimations,
    setEnableHighFidelityAnimations,
    enableHighFrequencyPolling,
    setEnableHighFrequencyPolling,
    pollingInterval,
    setPollingInterval,
    loading,
    refreshSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 