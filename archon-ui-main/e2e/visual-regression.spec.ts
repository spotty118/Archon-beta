/**
 * E2E Visual Regression Tests
 * Tests visual consistency across browsers and prevents UI regressions
 */

import { test, expect } from '@playwright/test'

test.describe('Visual Regression Testing', () => {
  // Configure visual testing settings
  test.use({ 
    viewport: { width: 1280, height: 720 },
    // Disable animations for consistent screenshots
    reducedMotion: 'reduce'
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
    
    // Disable animations for consistent visual testing
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    })
  })

  test('knowledge base page visual consistency', async ({ page }) => {
    // Navigate to knowledge base
    await page.goto('/')
    await expect(page.locator('h1')).toContainText(/knowledge base/i)
    
    // Wait for content to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000) // Additional wait for any async content
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('knowledge-base-full-page.png', {
      fullPage: true,
      animations: 'disabled'
    })
    
    // Take viewport screenshot
    await expect(page).toHaveScreenshot('knowledge-base-viewport.png', {
      animations: 'disabled'
    })
    
    // Test specific components
    const knowledgeContainer = page.locator('[data-testid="knowledge-base"]')
    if (await knowledgeContainer.isVisible()) {
      await expect(knowledgeContainer).toHaveScreenshot('knowledge-container.png')
    }
    
    // Test add knowledge button
    const addButton = page.locator('[data-testid="add-knowledge-item-button"]')
    if (await addButton.isVisible()) {
      await expect(addButton).toHaveScreenshot('add-knowledge-button.png')
    }
  })

  test('projects page visual consistency', async ({ page }) => {
    // Enable projects feature and navigate
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    if (!(await projectsNav.isVisible())) {
      await page.click('[data-testid="nav-settings"]')
      const projectToggle = page.locator('[data-testid="enable-projects-toggle"]')
      if (await projectToggle.isVisible() && !(await projectToggle.isChecked())) {
        await projectToggle.check()
        await page.waitForTimeout(1000)
      }
    }
    
    await page.click('[data-testid="nav-projects"]')
    await expect(page.locator('h1')).toContainText(/projects/i)
    
    // Wait for projects to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('projects-page-full.png', {
      fullPage: true,
      animations: 'disabled'
    })
    
    // Test projects container
    const projectsContainer = page.locator('[data-testid="projects-page"]')
    if (await projectsContainer.isVisible()) {
      await expect(projectsContainer).toHaveScreenshot('projects-container.png')
    }
    
    // Test create project button
    const createButton = page.locator('[data-testid="create-project-button"]')
    if (await createButton.isVisible()) {
      await expect(createButton).toHaveScreenshot('create-project-button.png')
    }
    
    // Test project cards if any exist
    const projectCards = page.locator('[data-testid="project-card"]')
    const cardCount = await projectCards.count()
    if (cardCount > 0) {
      await expect(projectCards.first()).toHaveScreenshot('project-card.png')
    }
  })

  test('settings page visual consistency', async ({ page }) => {
    await page.click('[data-testid="nav-settings"]')
    await expect(page.locator('h1')).toContainText(/settings/i)
    
    // Wait for settings to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('settings-page-full.png', {
      fullPage: true,
      animations: 'disabled'
    })
    
    // Test specific settings sections
    const apiSettings = page.locator('[data-testid="api-settings-section"]')
    if (await apiSettings.isVisible()) {
      await expect(apiSettings).toHaveScreenshot('api-settings-section.png')
    }
    
    const ragSettings = page.locator('[data-testid="rag-settings-section"]')
    if (await ragSettings.isVisible()) {
      await expect(ragSettings).toHaveScreenshot('rag-settings-section.png')
    }
    
    const projectSettings = page.locator('[data-testid="project-settings-section"]')
    if (await projectSettings.isVisible()) {
      await expect(projectSettings).toHaveScreenshot('project-settings-section.png')
    }
  })

  test('navigation bar visual consistency', async ({ page }) => {
    await page.goto('/')
    
    // Test main navigation
    const mainNav = page.locator('[data-testid="main-navigation"]')
    await expect(mainNav).toBeVisible()
    await expect(mainNav).toHaveScreenshot('main-navigation.png')
    
    // Test navigation items
    const navItems = page.locator('[data-testid^="nav-"]')
    const navCount = await navItems.count()
    
    for (let i = 0; i < navCount; i++) {
      const navItem = navItems.nth(i)
      if (await navItem.isVisible()) {
        const testId = await navItem.getAttribute('data-testid')
        await expect(navItem).toHaveScreenshot(`nav-item-${testId}.png`)
      }
    }
  })

  test('modal dialogs visual consistency', async ({ page }) => {
    await page.goto('/')
    
    // Test add knowledge modal
    const addKnowledgeButton = page.locator('[data-testid="add-knowledge-item-button"]')
    if (await addKnowledgeButton.isVisible()) {
      await addKnowledgeButton.click()
      
      const modal = page.locator('[data-testid="add-knowledge-modal"]')
      await expect(modal).toBeVisible()
      await expect(modal).toHaveScreenshot('add-knowledge-modal.png')
      
      // Close modal
      const cancelButton = page.locator('[data-testid="cancel-knowledge-item"]')
      if (await cancelButton.isVisible()) {
        await cancelButton.click()
      } else {
        await page.press('body', 'Escape')
      }
    }
    
    // Test create project modal if available
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    if (await projectsNav.isVisible()) {
      await projectsNav.click()
      
      const createProjectButton = page.locator('[data-testid="create-project-button"]')
      if (await createProjectButton.isVisible()) {
        await createProjectButton.click()
        
        const projectModal = page.locator('[data-testid="create-project-modal"]')
        await expect(projectModal).toBeVisible()
        await expect(projectModal).toHaveScreenshot('create-project-modal.png')
        
        // Close modal
        const cancelProjectButton = page.locator('[data-testid="cancel-create-project"]')
        if (await cancelProjectButton.isVisible()) {
          await cancelProjectButton.click()
        }
      }
    }
  })

  test('responsive design visual consistency', async ({ page }) => {
    // Test desktop view (already set in beforeEach)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    await expect(page).toHaveScreenshot('desktop-view-1280x720.png', {
      fullPage: true,
      animations: 'disabled'
    })
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500) // Wait for responsive layout
    
    await expect(page).toHaveScreenshot('tablet-view-768x1024.png', {
      fullPage: true,
      animations: 'disabled'
    })
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(500)
    
    await expect(page).toHaveScreenshot('mobile-view-375x667.png', {
      fullPage: true,
      animations: 'disabled'
    })
    
    // Test navigation in mobile view
    const mobileNav = page.locator('[data-testid="main-navigation"]')
    if (await mobileNav.isVisible()) {
      await expect(mobileNav).toHaveScreenshot('mobile-navigation.png')
    }
    
    // Test mobile menu if available
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]')
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click()
      await page.waitForTimeout(300)
      
      const mobileMenu = page.locator('[data-testid="mobile-menu"]')
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toHaveScreenshot('mobile-menu-expanded.png')
      }
    }
  })

  test('dark mode visual consistency', async ({ page }) => {
    await page.goto('/')
    
    // Look for dark mode toggle
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]')
    if (await darkModeToggle.isVisible()) {
      // Test light mode first
      await expect(page).toHaveScreenshot('light-mode-full-page.png', {
        fullPage: true,
        animations: 'disabled'
      })
      
      // Switch to dark mode
      await darkModeToggle.click()
      await page.waitForTimeout(500) // Wait for theme transition
      
      // Test dark mode
      await expect(page).toHaveScreenshot('dark-mode-full-page.png', {
        fullPage: true,
        animations: 'disabled'
      })
      
      // Test specific components in dark mode
      const mainNav = page.locator('[data-testid="main-navigation"]')
      if (await mainNav.isVisible()) {
        await expect(mainNav).toHaveScreenshot('dark-mode-navigation.png')
      }
      
      const knowledgeContainer = page.locator('[data-testid="knowledge-base"]')
      if (await knowledgeContainer.isVisible()) {
        await expect(knowledgeContainer).toHaveScreenshot('dark-mode-knowledge-container.png')
      }
    } else {
      test.skip('Dark mode toggle not available')
    }
  })

  test('loading states visual consistency', async ({ page }) => {
    // Slow down network to capture loading states
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100)
    })
    
    await page.goto('/')
    
    // Try to capture loading states
    const loadingIndicators = page.locator('[data-testid*="loading"], [data-testid*="spinner"]')
    const loadingCount = await loadingIndicators.count()
    
    if (loadingCount > 0) {
      for (let i = 0; i < loadingCount; i++) {
        const loader = loadingIndicators.nth(i)
        if (await loader.isVisible()) {
          const testId = await loader.getAttribute('data-testid')
          await expect(loader).toHaveScreenshot(`loading-${testId}.png`)
        }
      }
    }
    
    // Test crawling progress if available
    const addKnowledgeButton = page.locator('[data-testid="add-knowledge-item-button"]')
    if (await addKnowledgeButton.isVisible()) {
      await addKnowledgeButton.click()
      
      const modal = page.locator('[data-testid="add-knowledge-modal"]')
      await expect(modal).toBeVisible()
      
      // Fill form quickly and submit to catch progress state
      await page.fill('[data-testid="knowledge-url-input"]', 'https://httpbin.org/html')
      await page.fill('[data-testid="knowledge-title-input"]', 'Loading Test')
      await page.click('[data-testid="submit-knowledge-item"]')
      
      // Try to capture crawling progress
      const progress = page.locator('[data-testid="crawling-progress"]')
      if (await progress.isVisible()) {
        await expect(progress).toHaveScreenshot('crawling-progress.png')
      }
    }
  })

  test('error states visual consistency', async ({ page }) => {
    await page.goto('/')
    
    // Test form validation errors
    const addKnowledgeButton = page.locator('[data-testid="add-knowledge-item-button"]')
    if (await addKnowledgeButton.isVisible()) {
      await addKnowledgeButton.click()
      
      const modal = page.locator('[data-testid="add-knowledge-modal"]')
      await expect(modal).toBeVisible()
      
      // Try to submit empty form to trigger validation
      await page.click('[data-testid="submit-knowledge-item"]')
      
      // Wait for validation errors
      await page.waitForTimeout(500)
      
      // Capture validation error state
      await expect(modal).toHaveScreenshot('form-validation-errors.png')
      
      // Try invalid URL to trigger different error
      await page.fill('[data-testid="knowledge-url-input"]', 'invalid-url')
      await page.fill('[data-testid="knowledge-title-input"]', 'Error Test')
      await page.click('[data-testid="submit-knowledge-item"]')
      
      // Wait for URL validation error
      await page.waitForTimeout(500)
      
      const errorMessage = page.locator('[data-testid="error-message"]')
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toHaveScreenshot('url-validation-error.png')
      }
      
      // Close modal
      const cancelButton = page.locator('[data-testid="cancel-knowledge-item"]')
      if (await cancelButton.isVisible()) {
        await cancelButton.click()
      }
    }
  })

  test('empty states visual consistency', async ({ page }) => {
    await page.goto('/')
    
    // Test empty knowledge base state
    const emptyKnowledgeState = page.locator('[data-testid="empty-knowledge-state"]')
    if (await emptyKnowledgeState.isVisible()) {
      await expect(emptyKnowledgeState).toHaveScreenshot('empty-knowledge-state.png')
    }
    
    // Test empty projects state
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    if (await projectsNav.isVisible()) {
      await projectsNav.click()
      
      const emptyProjectsState = page.locator('[data-testid="empty-projects-state"]')
      if (await emptyProjectsState.isVisible()) {
        await expect(emptyProjectsState).toHaveScreenshot('empty-projects-state.png')
      }
    }
    
    // Test empty search results
    const searchInput = page.locator('[data-testid="knowledge-search"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('nonexistent search term xyz123')
      await page.press('[data-testid="knowledge-search"]', 'Enter')
      await page.waitForTimeout(1000)
      
      const emptySearchState = page.locator('[data-testid="empty-search-results"]')
      if (await emptySearchState.isVisible()) {
        await expect(emptySearchState).toHaveScreenshot('empty-search-results.png')
      }
    }
  })

  test('accessibility visual indicators', async ({ page }) => {
    await page.goto('/')
    
    // Test focus states
    const focusableElements = page.locator('button, input, select, textarea, a[href]')
    const focusableCount = await focusableElements.count()
    
    if (focusableCount > 0) {
      // Focus on first button and capture focus state
      const firstButton = page.locator('button').first()
      await firstButton.focus()
      await expect(firstButton).toHaveScreenshot('button-focus-state.png')
      
      // Focus on first input and capture focus state
      const firstInput = page.locator('input').first()
      if (await firstInput.isVisible()) {
        await firstInput.focus()
        await expect(firstInput).toHaveScreenshot('input-focus-state.png')
      }
    }
    
    // Test high contrast mode if supported
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.waitForTimeout(500)
    
    await expect(page).toHaveScreenshot('high-contrast-mode.png', {
      fullPage: true,
      animations: 'disabled'
    })
  })

  test('browser-specific visual consistency', async ({ page, browserName }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Take browser-specific screenshots
    await expect(page).toHaveScreenshot(`${browserName}-full-page.png`, {
      fullPage: true,
      animations: 'disabled'
    })
    
    // Test specific components in each browser
    const mainNav = page.locator('[data-testid="main-navigation"]')
    if (await mainNav.isVisible()) {
      await expect(mainNav).toHaveScreenshot(`${browserName}-navigation.png`)
    }
    
    const knowledgeContainer = page.locator('[data-testid="knowledge-base"]')
    if (await knowledgeContainer.isVisible()) {
      await expect(knowledgeContainer).toHaveScreenshot(`${browserName}-knowledge-container.png`)
    }
  })
})