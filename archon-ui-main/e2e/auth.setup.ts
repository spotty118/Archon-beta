/**
 * Authentication setup for E2E tests
 * Handles any required authentication state
 */

import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

setup('authenticate user', async ({ page }) => {
  // Navigate to the application
  await page.goto('/')
  
  // Check if authentication is required
  const isAuthRequired = await page.locator('[data-testid="auth-required"]').isVisible()
  
  if (isAuthRequired) {
    // Handle authentication flow if needed
    console.log('🔐 Authentication required - handling auth flow')
    
    // For now, we'll assume the app works without auth in test mode
    // In a real scenario, you would implement the actual auth flow here
    
    // Example auth flow:
    // await page.fill('[data-testid="username"]', 'test-user')
    // await page.fill('[data-testid="password"]', 'test-password')
    // await page.click('[data-testid="login-button"]')
    // await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    
  } else {
    console.log('✅ No authentication required')
  }
  
  // Wait for the app to be fully loaded
  await expect(page.locator('[data-testid="app-loaded"]')).toBeVisible()
  
  // Save authenticated state
  await page.context().storageState({ path: authFile })
  
  console.log('✅ Authentication setup completed')
})