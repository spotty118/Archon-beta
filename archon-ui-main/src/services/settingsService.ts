import { getApiUrl } from '../config/api';

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  autoRefresh: boolean;
  refreshInterval: number; // in milliseconds
  showNotifications: boolean;
  enableProjectsFeature: boolean;
  maxConcurrentTasks: number;
  defaultCrawlDepth: number;
  compactMode: boolean;
  debugMode: boolean;
  language: string;
}

export interface UserPreferences {
  sidebarCollapsed: boolean;
  preferredView: 'grid' | 'list';
  itemsPerPage: number;
  enableKeyboardShortcuts: boolean;
  showTooltips: boolean;
  autoSaveInterval: number; // in seconds
}

export interface SystemSettings {
  apiUrl: string;
  version: string;
  buildDate: string;
  environment: 'development' | 'production' | 'staging';
}

class SettingsService {
  private baseUrl = getApiUrl();
  private localStoragePrefix = 'archon_';

  // Default settings
  private defaultAppSettings: AppSettings = {
    theme: 'system',
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
    showNotifications: true,
    enableProjectsFeature: true,
    maxConcurrentTasks: 5,
    defaultCrawlDepth: 3,
    compactMode: false,
    debugMode: false,
    language: 'en'
  };

  private defaultUserPreferences: UserPreferences = {
    sidebarCollapsed: false,
    preferredView: 'grid',
    itemsPerPage: 20,
    enableKeyboardShortcuts: true,
    showTooltips: true,
    autoSaveInterval: 300 // 5 minutes
  };

  // App Settings (stored on server)
  async getAppSettings(): Promise<AppSettings> {
    try {
      const response = await fetch(`${this.baseUrl}/api/settings/app`);
      if (!response.ok) {
        console.warn('Failed to fetch app settings from server, using defaults');
        return this.defaultAppSettings;
      }
      const serverSettings = await response.json();
      return { ...this.defaultAppSettings, ...serverSettings };
    } catch (error) {
      console.warn('Error fetching app settings:', error);
      return this.defaultAppSettings;
    }
  }

  async updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/settings/app`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update app settings on server');
      }
    } catch (error) {
      console.error('Error updating app settings:', error);
      throw error;
    }
  }

  // User Preferences (stored locally)
  getUserPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(`${this.localStoragePrefix}user_preferences`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...this.defaultUserPreferences, ...parsed };
      }
    } catch (error) {
      console.warn('Error loading user preferences from localStorage:', error);
    }
    return this.defaultUserPreferences;
  }

  updateUserPreferences(preferences: Partial<UserPreferences>): void {
    try {
      const current = this.getUserPreferences();
      const updated = { ...current, ...preferences };
      localStorage.setItem(
        `${this.localStoragePrefix}user_preferences`, 
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('Error saving user preferences to localStorage:', error);
      throw error;
    }
  }

  // System Settings (read-only, from server)
  async getSystemSettings(): Promise<SystemSettings> {
    try {
      const response = await fetch(`${this.baseUrl}/api/settings/system`);
      if (!response.ok) {
        throw new Error('Failed to fetch system settings');
      }
      return response.json();
    } catch (error) {
      console.error('Error fetching system settings:', error);
      // Return fallback system settings
      return {
        apiUrl: this.baseUrl,
        version: 'unknown',
        buildDate: 'unknown',
        environment: 'development'
      };
    }
  }

  // Feature flags and experimental features
  async getFeatureFlags(): Promise<Record<string, boolean>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/settings/features`);
      if (!response.ok) {
        return {};
      }
      return response.json();
    } catch (error) {
      console.warn('Error fetching feature flags:', error);
      return {};
    }
  }

  isFeatureEnabled(featureName: string): boolean {
    // This could be enhanced to check server-side feature flags
    // For now, check localStorage for user-enabled experimental features
    try {
      const experimentalFeatures = localStorage.getItem(`${this.localStoragePrefix}experimental_features`);
      if (experimentalFeatures) {
        const features = JSON.parse(experimentalFeatures);
        return features[featureName] === true;
      }
    } catch (error) {
      console.warn('Error checking experimental features:', error);
    }
    return false;
  }

  enableExperimentalFeature(featureName: string, enabled: boolean): void {
    try {
      const stored = localStorage.getItem(`${this.localStoragePrefix}experimental_features`);
      const features = stored ? JSON.parse(stored) : {};
      features[featureName] = enabled;
      localStorage.setItem(
        `${this.localStoragePrefix}experimental_features`, 
        JSON.stringify(features)
      );
    } catch (error) {
      console.error('Error updating experimental features:', error);
    }
  }

  // Settings validation and migration
  validateSettings(settings: any): boolean {
    // Basic validation for settings structure
    if (!settings || typeof settings !== 'object') {
      return false;
    }
    return true;
  }

  // Clear all local settings (for reset functionality)
  clearLocalSettings(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(this.localStoragePrefix)
      );
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing local settings:', error);
    }
  }

  // Export settings for backup
  async exportSettings(): Promise<{
    appSettings: AppSettings;
    userPreferences: UserPreferences;
    experimentalFeatures: Record<string, boolean>;
    timestamp: string;
  }> {
    const appSettings = await this.getAppSettings();
    const userPreferences = this.getUserPreferences();
    
    let experimentalFeatures = {};
    try {
      const stored = localStorage.getItem(`${this.localStoragePrefix}experimental_features`);
      if (stored) {
        experimentalFeatures = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Error reading experimental features for export:', error);
    }

    return {
      appSettings,
      userPreferences,
      experimentalFeatures,
      timestamp: new Date().toISOString()
    };
  }

  // Import settings from backup
  async importSettings(settingsData: {
    appSettings?: Partial<AppSettings>;
    userPreferences?: Partial<UserPreferences>;
    experimentalFeatures?: Record<string, boolean>;
  }): Promise<void> {
    try {
      if (settingsData.appSettings) {
        await this.updateAppSettings(settingsData.appSettings);
      }
      
      if (settingsData.userPreferences) {
        this.updateUserPreferences(settingsData.userPreferences);
      }
      
      if (settingsData.experimentalFeatures) {
        localStorage.setItem(
          `${this.localStoragePrefix}experimental_features`,
          JSON.stringify(settingsData.experimentalFeatures)
        );
      }
    } catch (error) {
      console.error('Error importing settings:', error);
      throw error;
    }
  }
}

export const settingsService = new SettingsService();