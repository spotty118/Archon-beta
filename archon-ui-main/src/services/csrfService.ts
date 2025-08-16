/**
 * CSRF Token Service for handling Cross-Site Request Forgery protection
 */

import { API_BASE_URL } from '../config/api';

class CSRFService {
  private token: string | null = null;
  private sessionId: string | null = null;
  private tokenPromise: Promise<void> | null = null;

  /**
   * Get a valid CSRF token, fetching one if needed
   */
  async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }

    // If a token request is already in progress, wait for it
    if (this.tokenPromise) {
      await this.tokenPromise;
      return this.token!;
    }

    // Start a new token request
    this.tokenPromise = this.fetchToken();
    await this.tokenPromise;
    this.tokenPromise = null;

    return this.token!;
  }

  /**
   * Fetch a new CSRF token from the server
   */
  private async fetchToken(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.sessionId ? { 'X-Session-ID': this.sessionId } : {})
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.csrf_token;
      this.sessionId = data.session_id;

      console.log('🔐 [CSRF] Token fetched successfully');
    } catch (error) {
      console.error('❌ [CSRF] Failed to fetch token:', error);
      throw error;
    }
  }

  /**
   * Clear the stored token (e.g., when it becomes invalid)
   */
  clearToken(): void {
    this.token = null;
    console.log('🔐 [CSRF] Token cleared');
  }

  /**
   * Get headers object with CSRF token
   */
  async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'X-CSRF-Token': token,
      ...(this.sessionId ? { 'X-Session-ID': this.sessionId } : {})
    };
  }
}

// Export singleton instance
export const csrfService = new CSRFService();
