import { useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';

interface UseSmartPollingOptions {
  /** Function to execute on each poll */
  pollFunction: () => void | Promise<void>;
  /** Base interval in milliseconds (will be adjusted based on settings) */
  baseInterval: number;
  /** Whether polling should be enabled at all */
  enabled?: boolean;
  /** Whether to poll immediately on mount */
  immediate?: boolean;
  /** Multiplier for interval when page is not visible (default: 4x slower) */
  backgroundMultiplier?: number;
  /** Whether this polling is high frequency and should respect the setting */
  respectHighFrequencyPolling?: boolean;
}

/**
 * Smart polling hook that respects performance settings and page visibility
 * 
 * Features:
 * - Respects enableHighFrequencyPolling setting
 * - Uses custom pollingInterval from settings
 * - Automatically reduces frequency when page is not visible
 * - Handles cleanup properly
 * - Supports immediate execution
 */
export const useSmartPolling = ({
  pollFunction,
  baseInterval,
  enabled = true,
  immediate = false,
  backgroundMultiplier = 4,
  respectHighFrequencyPolling = true
}: UseSmartPollingOptions) => {
  const { enableHighFrequencyPolling, pollingInterval } = useSettings();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const pollFunctionRef = useRef(pollFunction);

  // Update the poll function reference
  useEffect(() => {
    pollFunctionRef.current = pollFunction;
  }, [pollFunction]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      // Restart polling with new interval when visibility changes
      if (enabled) {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  const getEffectiveInterval = useCallback(() => {
    let interval = baseInterval;

    // Use custom polling interval if high frequency polling is enabled
    if (respectHighFrequencyPolling && enableHighFrequencyPolling) {
      interval = Math.min(pollingInterval, baseInterval);
    } else if (respectHighFrequencyPolling && !enableHighFrequencyPolling) {
      // If high frequency polling is disabled, use a longer interval
      interval = Math.max(pollingInterval, baseInterval);
    }

    // Increase interval when page is not visible
    if (!isVisibleRef.current) {
      interval *= backgroundMultiplier;
    }

    return interval;
  }, [baseInterval, enableHighFrequencyPolling, pollingInterval, backgroundMultiplier, respectHighFrequencyPolling]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    
    if (!enabled) return;

    const interval = getEffectiveInterval();
    
    intervalRef.current = setInterval(async () => {
      try {
        await pollFunctionRef.current();
      } catch (error) {
        console.error('Smart polling error:', error);
      }
    }, interval);
  }, [enabled, getEffectiveInterval, stopPolling]);

  // Start/restart polling when dependencies change
  useEffect(() => {
    if (enabled) {
      startPolling();
      
      // Execute immediately if requested
      if (immediate) {
        const executeImmediate = async () => {
          try {
            await pollFunctionRef.current();
          } catch (error) {
            console.error('Smart polling immediate execution error:', error);
          }
        };
        executeImmediate();
      }
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [enabled, immediate, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  return {
    startPolling,
    stopPolling,
    isPolling: intervalRef.current !== null,
    effectiveInterval: getEffectiveInterval()
  };
};

/**
 * Hook for conditional polling that only polls when a condition is met
 */
export const useConditionalPolling = (
  condition: boolean,
  options: Omit<UseSmartPollingOptions, 'enabled'>
) => {
  return useSmartPolling({
    ...options,
    enabled: condition
  });
};

/**
 * Hook for adaptive polling that adjusts interval based on success/error rate
 */
export const useAdaptivePolling = (
  options: UseSmartPollingOptions & {
    /** Multiplier for interval on consecutive errors (default: 2) */
    errorMultiplier?: number;
    /** Maximum interval cap in milliseconds */
    maxInterval?: number;
  }
) => {
  const errorCountRef = useRef(0);
  const { errorMultiplier = 2, maxInterval = 300000, ...smartPollingOptions } = options;

  const adaptivePollFunction = useCallback(async () => {
    try {
      await options.pollFunction();
      // Reset error count on success
      errorCountRef.current = 0;
    } catch (error) {
      errorCountRef.current++;
      throw error;
    }
  }, [options.pollFunction]);

  const adaptiveInterval = Math.min(
    options.baseInterval * Math.pow(errorMultiplier, errorCountRef.current),
    maxInterval
  );

  return useSmartPolling({
    ...smartPollingOptions,
    pollFunction: adaptivePollFunction,
    baseInterval: adaptiveInterval
  });
};