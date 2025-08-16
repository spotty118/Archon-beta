/**
 * E2E tests for Navigation and Routing
 * Tests the main navigation flow and page routing
 */

import { test, expect } from '@playwright/test'

test.describe('Application Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('displays main navigation elements', async ({ page }) => {
    // Check that navigation is visible
    const navigation = page.locator('[data-testid="main-navigation"]')
    await expect(navigation).toBeVisible()
    
    // Check for main navigation links
    await expect(page.locator('[data-testid="nav-knowledge-base"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-settings"]')).toBeVisible()
    
    // Check for conditional navigation (if features are enabled)
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    const mcpNav = page.locator('[data-testid="nav-mcp"]')
    
    // These may or may not be visible depending on configuration
    const hasProjects = await projectsNav.isVisible()
    const hasMcp = await mcpNav.isVisible()
    
    console.log(`Projects navigation visible: ${hasProjects}`)
    console.log(`MCP navigation visible: ${hasMcp}`)
  })

  test('can navigate to Knowledge Base page', async ({ page }) => {
    await page.click('[data-testid="nav-knowledge-base"]')
    
    // Check URL
    expect(page.url()).toContain('/')
    
    // Check page content
    await expect(page.locator('h1')).toContainText(/knowledge base/i)
    await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible()
    
    // Check active navigation state
    const navItem = page.locator('[data-testid="nav-knowledge-base"]')
    await expect(navItem).toHaveClass(/active|selected|current/)
  })

  test('can navigate to Settings page', async ({ page }) => {
    await page.click('[data-testid="nav-settings"]')
    
    // Check URL
    expect(page.url()).toContain('/settings')
    
    // Check page content
    await expect(page.locator('h1')).toContainText(/settings/i)
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    
    // Check active navigation state
    const navItem = page.locator('[data-testid="nav-settings"]')
    await expect(navItem).toHaveClass(/active|selected|current/)
  })

  test('can navigate to Projects page if enabled', async ({ page }) => {
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    
    if (!await projectsNav.isVisible()) {
      test.skip('Projects feature is not enabled')
    }
    
    await projectsNav.click()
    
    // Check URL
    expect(page.url()).toContain('/projects')
    
    // Check page content
    await expect(page.locator('h1')).toContainText(/projects/i)
    await expect(page.locator('[data-testid="projects-page"]')).toBeVisible()
    
    // Check active navigation state
    await expect(projectsNav).toHaveClass(/active|selected|current/)
  })

  test('can navigate to MCP page if enabled', async ({ page }) => {
    const mcpNav = page.locator('[data-testid="nav-mcp"]')
    
    if (!await mcpNav.isVisible()) {
      test.skip('MCP feature is not enabled')
    }
    
    await mcpNav.click()
    
    // Check URL
    expect(page.url()).toContain('/mcp')
    
    // Check page content
    await expect(page.locator('h1')).toContainText(/mcp/i)
    await expect(page.locator('[data-testid="mcp-page"]')).toBeVisible()
    
    // Check active navigation state
    await expect(mcpNav).toHaveClass(/active|selected|current/)
  })

  test('handles browser back and forward navigation', async ({ page }) => {
    // Start on knowledge base page
    await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible()
    
    // Navigate to settings
    await page.click('[data-testid="nav-settings"]')
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    
    // Use browser back button
    await page.goBack()
    await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible()
    expect(page.url()).not.toContain('/settings')
    
    // Use browser forward button
    await page.goForward()
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    expect(page.url()).toContain('/settings')
  })

  test('maintains navigation state across page refreshes', async ({ page }) => {
    // Navigate to settings
    await page.click('[data-testid="nav-settings"]')
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    
    // Refresh the page
    await page.reload()
    
    // Check that we're still on settings page
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    expect(page.url()).toContain('/settings')
    
    // Check that navigation shows correct active state
    const navItem = page.locator('[data-testid="nav-settings"]')
    await expect(navItem).toHaveClass(/active|selected|current/)
  })

  test('shows correct breadcrumbs if implemented', async ({ page }) => {
    const breadcrumbs = page.locator('[data-testid="breadcrumbs"]')
    
    if (!await breadcrumbs.isVisible()) {
      test.skip('Breadcrumbs not implemented')
    }
    
    // Test breadcrumbs on different pages
    await page.click('[data-testid="nav-settings"]')
    await expect(breadcrumbs).toContainText(/settings/i)
    
    // If projects are enabled, test sub-navigation
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    if (await projectsNav.isVisible()) {
      await projectsNav.click()
      await expect(breadcrumbs).toContainText(/projects/i)
    }
  })

  test('handles keyboard navigation', async ({ page }) => {
    // Focus on first navigation item
    const firstNavItem = page.locator('[data-testid="nav-knowledge-base"]')
    await firstNavItem.focus()
    
    // Check that it's focused
    await expect(firstNavItem).toBeFocused()
    
    // Test Enter key navigation
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible()
    
    // Test Tab navigation between nav items
    await firstNavItem.focus()
    await page.keyboard.press('Tab')
    
    // Check that focus moved to next navigation item
    const secondNavItem = page.locator('[data-testid="nav-settings"]')
    await expect(secondNavItem).toBeFocused()
  })

  test('displays connection status indicator', async ({ page }) => {
    const connectionStatus = page.locator('[data-testid="connection-status"]')
    
    if (!await connectionStatus.isVisible()) {
      test.skip('Connection status indicator not implemented')
    }
    
    // Check initial connection status
    const statusText = await connectionStatus.textContent()
    expect(['connected', 'online', 'disconnected', 'offline']).toContain(statusText?.toLowerCase())
    
    // Check for status icon/indicator
    const statusIcon = connectionStatus.locator('svg, [data-testid="status-icon"]')
    await expect(statusIcon).toBeVisible()
  })

  test('shows theme toggle functionality', async ({ page }) => {
    const themeToggle = page.locator('[data-testid="theme-toggle"]')
    
    if (!await themeToggle.isVisible()) {
      test.skip('Theme toggle not implemented')
    }
    
    // Get initial theme state
    const bodyClasses = await page.locator('body').getAttribute('class')
    const initialIsDark = bodyClasses?.includes('dark') || false
    
    // Toggle theme
    await themeToggle.click()
    
    // Wait for theme change
    await page.waitForTimeout(500)
    
    // Check that theme changed
    const newBodyClasses = await page.locator('body').getAttribute('class')
    const newIsDark = newBodyClasses?.includes('dark') || false
    
    expect(newIsDark).toBe(!initialIsDark)
    
    // Toggle back
    await themeToggle.click()
    await page.waitForTimeout(500)
    
    // Verify theme reverted
    const finalBodyClasses = await page.locator('body').getAttribute('class')
    const finalIsDark = finalBodyClasses?.includes('dark') || false
    
    expect(finalIsDark).toBe(initialIsDark)
  })

  test('handles mobile navigation if responsive', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check if mobile menu button exists
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]')
    
    if (!await mobileMenuButton.isVisible()) {
      test.skip('Mobile navigation not implemented')
    }
    
    // Open mobile menu
    await mobileMenuButton.click()
    
    // Check that mobile navigation is visible
    const mobileNav = page.locator('[data-testid="mobile-navigation"]')
    await expect(mobileNav).toBeVisible()
    
    // Test navigation in mobile view
    const mobileKnowledgeLink = mobileNav.locator('[data-testid="nav-knowledge-base"]')
    await mobileKnowledgeLink.click()
    
    // Check that menu closes after navigation
    await expect(mobileNav).not.toBeVisible()
    
    // Verify navigation worked
    await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible()
  })

  test('handles direct URL navigation', async ({ page }) => {
    // Test direct navigation to settings
    await page.goto('/settings')
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    
    // Check navigation state
    const settingsNav = page.locator('[data-testid="nav-settings"]')
    await expect(settingsNav).toHaveClass(/active|selected|current/)
    
    // Test direct navigation to projects (if enabled)
    const projectsEnabled = await page.locator('[data-testid="nav-projects"]').isVisible()
    if (projectsEnabled) {
      await page.goto('/projects')
      await expect(page.locator('[data-testid="projects-page"]')).toBeVisible()
      
      const projectsNav = page.locator('[data-testid="nav-projects"]')
      await expect(projectsNav).toHaveClass(/active|selected|current/)
    }
  })

  test('handles 404 pages gracefully', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/non-existent-page')
    
    // Check for 404 handling
    const notFoundPage = page.locator('[data-testid="not-found-page"]')
    const homeRedirect = page.locator('[data-testid="knowledge-base"]')
    
    // Either show 404 page or redirect to home
    const has404 = await notFoundPage.isVisible()
    const redirectedHome = await homeRedirect.isVisible()
    
    expect(has404 || redirectedHome).toBeTruthy()
    
    if (has404) {
      // Check for navigation back to home
      const homeLink = page.locator('[data-testid="back-to-home"]')
      if (await homeLink.isVisible()) {
        await homeLink.click()
        await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible()
      }
    }
  })
})