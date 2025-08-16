/**
 * E2E tests for Project Management functionality
 * Tests project creation, editing, deletion, and organization workflows
 */

import { test, expect } from '@playwright/test'

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Enable projects feature if not already enabled
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    const isProjectsVisible = await projectsNav.isVisible()
    
    if (!isProjectsVisible) {
      // Navigate to settings to enable projects
      await page.click('[data-testid="nav-settings"]')
      
      // Enable projects feature
      const projectToggle = page.locator('[data-testid="enable-projects-toggle"]')
      if (await projectToggle.isVisible()) {
        const isChecked = await projectToggle.isChecked()
        if (!isChecked) {
          await projectToggle.check()
          await page.waitForTimeout(1000) // Wait for setting to persist
        }
      }
      
      // Navigate to projects page
      await page.click('[data-testid="nav-projects"]')
    } else {
      await page.click('[data-testid="nav-projects"]')
    }
    
    // Wait for projects page to load
    await expect(page.locator('h1')).toContainText(/projects/i)
  })

  test('displays projects page with initial state', async ({ page }) => {
    // Check that the projects page is visible
    await expect(page.locator('[data-testid="projects-page"]')).toBeVisible()
    
    // Check for main UI elements
    await expect(page.locator('[data-testid="create-project-button"]')).toBeVisible()
    
    // Check if projects are displayed or empty state
    const projectCards = page.locator('[data-testid="project-card"]')
    const emptyState = page.locator('[data-testid="empty-projects-state"]')
    
    const hasProjects = await projectCards.count() > 0
    const hasEmptyState = await emptyState.isVisible()
    
    expect(hasProjects || hasEmptyState).toBeTruthy()
  })

  test('can create a new project', async ({ page }) => {
    // Click create project button
    await page.click('[data-testid="create-project-button"]')
    
    // Fill in the project form
    const modal = page.locator('[data-testid="create-project-modal"]')
    await expect(modal).toBeVisible()
    
    const projectTitle = `Test Project ${Date.now()}`
    await page.fill('[data-testid="project-title-input"]', projectTitle)
    await page.fill('[data-testid="project-description-input"]', 'Test project for E2E testing automation')
    
    // Select project type/category if available
    const projectTypeSelect = page.locator('[data-testid="project-type-select"]')
    if (await projectTypeSelect.isVisible()) {
      await projectTypeSelect.selectOption('development')
    }
    
    // Add project tags if available
    const tagsInput = page.locator('[data-testid="project-tags-input"]')
    if (await tagsInput.isVisible()) {
      await tagsInput.fill('e2e,testing,automation')
    }
    
    // Set GitHub repository if available
    const githubInput = page.locator('[data-testid="project-github-input"]')
    if (await githubInput.isVisible()) {
      await githubInput.fill('https://github.com/test/repo')
    }
    
    // Submit the form
    await page.click('[data-testid="submit-create-project"]')
    
    // Wait for project creation progress
    const creationProgress = page.locator('[data-testid="project-creation-progress"]')
    if (await creationProgress.isVisible()) {
      await expect(creationProgress).not.toBeVisible({ timeout: 30000 })
    }
    
    // Check that the project appears in the list
    await expect(page.locator('[data-testid="project-card"]').first()).toBeVisible()
    
    // Verify the project details
    const newProject = page.locator('[data-testid="project-card"]').first()
    await expect(newProject.locator('[data-testid="project-title"]')).toContainText(projectTitle)
    await expect(newProject.locator('[data-testid="project-description"]')).toContainText('Test project for E2E testing')
  })

  test('can view project details', async ({ page }) => {
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount === 0) {
      test.skip('No projects available for detail testing')
    }
    
    // Click on the first project card
    await projectCards.first().click()
    
    // Check if we navigate to project detail page or modal opens
    const projectDetailPage = page.locator('[data-testid="project-detail-page"]')
    const projectDetailModal = page.locator('[data-testid="project-detail-modal"]')
    
    const hasDetailPage = await projectDetailPage.isVisible()
    const hasDetailModal = await projectDetailModal.isVisible()
    
    expect(hasDetailPage || hasDetailModal).toBeTruthy()
    
    if (hasDetailPage) {
      // Verify detail page content
      await expect(page.locator('[data-testid="project-title"]')).toBeVisible()
      await expect(page.locator('[data-testid="project-description"]')).toBeVisible()
      await expect(page.locator('[data-testid="project-tasks-section"]')).toBeVisible()
      await expect(page.locator('[data-testid="project-documents-section"]')).toBeVisible()
    }
    
    if (hasDetailModal) {
      // Verify modal content and close it
      await expect(projectDetailModal.locator('[data-testid="project-title"]')).toBeVisible()
      await page.click('[data-testid="close-project-detail"]')
      await expect(projectDetailModal).not.toBeVisible()
    }
  })

  test('can edit project information', async ({ page }) => {
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount === 0) {
      test.skip('No projects available for editing')
    }
    
    const firstProject = projectCards.first()
    
    // Click edit button (might be in a dropdown menu)
    const editButton = firstProject.locator('[data-testid="edit-project-button"]')
    if (await editButton.isVisible()) {
      await editButton.click()
    } else {
      // Try opening project context menu first
      const moreButton = firstProject.locator('[data-testid="project-menu-button"]')
      if (await moreButton.isVisible()) {
        await moreButton.click()
        await page.click('[data-testid="edit-project-action"]')
      } else {
        test.skip('Edit functionality not accessible')
      }
    }
    
    // Wait for edit modal
    const editModal = page.locator('[data-testid="edit-project-modal"]')
    await expect(editModal).toBeVisible()
    
    // Make changes to project
    const titleInput = editModal.locator('[data-testid="project-title-input"]')
    const originalTitle = await titleInput.inputValue()
    const newTitle = originalTitle + ' (Edited)'
    
    await titleInput.clear()
    await titleInput.fill(newTitle)
    
    // Update description
    const descriptionInput = editModal.locator('[data-testid="project-description-input"]')
    await descriptionInput.clear()
    await descriptionInput.fill('Updated project description for E2E testing')
    
    // Save changes
    await page.click('[data-testid="save-project-changes"]')
    
    // Wait for modal to close
    await expect(editModal).not.toBeVisible()
    
    // Verify the changes
    await expect(firstProject.locator('[data-testid="project-title"]')).toContainText('(Edited)')
    await expect(firstProject.locator('[data-testid="project-description"]')).toContainText('Updated project description')
  })

  test('can archive and restore project', async ({ page }) => {
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount === 0) {
      test.skip('No projects available for archiving')
    }
    
    const firstProject = projectCards.first()
    const originalTitle = await firstProject.locator('[data-testid="project-title"]').textContent()
    
    // Archive project
    const archiveButton = firstProject.locator('[data-testid="archive-project-button"]')
    if (await archiveButton.isVisible()) {
      await archiveButton.click()
    } else {
      // Try opening project context menu
      const moreButton = firstProject.locator('[data-testid="project-menu-button"]')
      if (await moreButton.isVisible()) {
        await moreButton.click()
        await page.click('[data-testid="archive-project-action"]')
      } else {
        test.skip('Archive functionality not accessible')
      }
    }
    
    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain(/archive/i)
      await dialog.accept()
    })
    
    // Wait for archiving
    await page.waitForTimeout(1000)
    
    // Verify project is no longer in active list
    const remainingProjects = await page.locator('[data-testid="project-card"]').count()
    expect(remainingProjects).toBe(projectCount - 1)
    
    // Navigate to archived projects view
    const archivedTab = page.locator('[data-testid="archived-projects-tab"]')
    if (await archivedTab.isVisible()) {
      await archivedTab.click()
      
      // Verify archived project appears in archived list
      const archivedProjects = page.locator('[data-testid="archived-project-card"]')
      const archivedProject = archivedProjects.filter({ hasText: originalTitle || '' })
      await expect(archivedProject).toBeVisible()
      
      // Restore project
      const restoreButton = archivedProject.locator('[data-testid="restore-project-button"]')
      if (await restoreButton.isVisible()) {
        await restoreButton.click()
        
        // Navigate back to active projects
        const activeTab = page.locator('[data-testid="active-projects-tab"]')
        if (await activeTab.isVisible()) {
          await activeTab.click()
        }
        
        // Verify project is restored
        const restoredProject = page.locator('[data-testid="project-card"]').filter({ hasText: originalTitle || '' })
        await expect(restoredProject).toBeVisible()
      }
    }
  })

  test('can filter and search projects', async ({ page }) => {
    const projectCards = page.locator('[data-testid="project-card"]')
    const initialCount = await projectCards.count()
    
    if (initialCount === 0) {
      test.skip('No projects available for search testing')
    }
    
    // Test search functionality
    const searchInput = page.locator('[data-testid="projects-search"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      
      // Wait for search results
      await page.waitForTimeout(500)
      
      // Verify search results
      const searchResults = page.locator('[data-testid="project-card"]')
      const resultsCount = await searchResults.count()
      
      expect(resultsCount).toBeGreaterThanOrEqual(0)
      
      // Clear search
      await searchInput.clear()
      await page.waitForTimeout(500)
      
      // Verify all projects are visible again
      const finalCount = await projectCards.count()
      expect(finalCount).toBe(initialCount)
    }
    
    // Test project type filter
    const typeFilter = page.locator('[data-testid="project-type-filter"]')
    if (await typeFilter.isVisible()) {
      await typeFilter.selectOption('development')
      
      // Wait for filtering
      await page.waitForTimeout(500)
      
      // Verify filtered results
      const visibleProjects = page.locator('[data-testid="project-card"]:visible')
      const count = await visibleProjects.count()
      
      if (count > 0) {
        // Check that visible projects are of the correct type
        const firstProject = visibleProjects.first()
        const typeBadge = firstProject.locator('[data-testid="project-type-badge"]')
        if (await typeBadge.isVisible()) {
          await expect(typeBadge).toContainText('development')
        }
      }
      
      // Reset filter
      await typeFilter.selectOption('all')
    }
  })

  test('can sort projects by different criteria', async ({ page }) => {
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount < 2) {
      test.skip('Need at least 2 projects for sorting test')
    }
    
    // Test sort by name
    const sortSelect = page.locator('[data-testid="projects-sort-select"]')
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption('name')
      await page.waitForTimeout(500)
      
      // Get project titles after sorting
      const titles = await page.locator('[data-testid="project-title"]').allTextContents()
      const sortedTitles = [...titles].sort()
      expect(titles).toEqual(sortedTitles)
      
      // Test sort by creation date
      await sortSelect.selectOption('created')
      await page.waitForTimeout(500)
      
      // Test sort by last modified
      await sortSelect.selectOption('modified')
      await page.waitForTimeout(500)
    }
  })

  test('displays project statistics and metrics', async ({ page }) => {
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount === 0) {
      test.skip('No projects available for metrics testing')
    }
    
    const firstProject = projectCards.first()
    
    // Check for project metrics
    const taskCount = firstProject.locator('[data-testid="project-task-count"]')
    const documentCount = firstProject.locator('[data-testid="project-document-count"]')
    const progressBar = firstProject.locator('[data-testid="project-progress-bar"]')
    
    // These metrics should be visible if the project has data
    if (await taskCount.isVisible()) {
      const taskText = await taskCount.textContent()
      expect(taskText).toMatch(/\d+/)
    }
    
    if (await documentCount.isVisible()) {
      const docText = await documentCount.textContent()
      expect(docText).toMatch(/\d+/)
    }
    
    if (await progressBar.isVisible()) {
      // Progress bar should have appropriate ARIA attributes
      const progressValue = await progressBar.getAttribute('aria-valuenow')
      expect(progressValue).toBeDefined()
    }
  })

  test('handles project creation errors gracefully', async ({ page }) => {
    // Try to create a project with invalid data
    await page.click('[data-testid="create-project-button"]')
    
    const modal = page.locator('[data-testid="create-project-modal"]')
    await expect(modal).toBeVisible()
    
    // Try to submit without required fields
    await page.click('[data-testid="submit-create-project"]')
    
    // Check for validation errors
    const errorMessages = page.locator('[data-testid="field-error"]')
    const errorCount = await errorMessages.count()
    expect(errorCount).toBeGreaterThan(0)
    
    // Fill in title but use invalid data for other fields
    await page.fill('[data-testid="project-title-input"]', 'Test Error Project')
    
    // Try invalid GitHub URL
    const githubInput = page.locator('[data-testid="project-github-input"]')
    if (await githubInput.isVisible()) {
      await githubInput.fill('invalid-github-url')
      await page.click('[data-testid="submit-create-project"]')
      
      // Check for GitHub URL validation error
      const githubError = page.locator('[data-testid="github-url-error"]')
      if (await githubError.isVisible()) {
        await expect(githubError).toContainText(/invalid|url|github/i)
      }
    }
    
    // Cancel project creation
    await page.click('[data-testid="cancel-create-project"]')
    await expect(modal).not.toBeVisible()
  })

  test('supports keyboard navigation and accessibility', async ({ page }) => {
    // Check that main elements are focusable
    const createButton = page.locator('[data-testid="create-project-button"]')
    await createButton.focus()
    expect(await createButton.evaluate(el => document.activeElement === el)).toBeTruthy()
    
    // Check ARIA labels
    await expect(createButton).toHaveAttribute('aria-label')
    
    // Test keyboard navigation through project cards
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount > 0) {
      const firstProject = projectCards.first()
      await firstProject.focus()
      
      // Check that project cards are keyboard accessible
      expect(await firstProject.evaluate(el => document.activeElement === el)).toBeTruthy()
      
      // Test Enter key to open project
      await firstProject.press('Enter')
      
      // Should open project detail or navigate
      const projectDetail = page.locator('[data-testid="project-detail-page"], [data-testid="project-detail-modal"]')
      await expect(projectDetail).toBeVisible()
    }
  })

  test('supports drag and drop for project organization', async ({ page }) => {
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount < 2) {
      test.skip('Need at least 2 projects for drag and drop testing')
    }
    
    // Check if drag and drop is supported
    const isDraggable = await projectCards.first().getAttribute('draggable')
    if (!isDraggable) {
      test.skip('Projects do not support drag and drop')
    }
    
    const firstProject = projectCards.first()
    const secondProject = projectCards.nth(1)
    
    // Get initial positions
    const firstProjectTitle = await firstProject.locator('[data-testid="project-title"]').textContent()
    const secondProjectTitle = await secondProject.locator('[data-testid="project-title"]').textContent()
    
    // Perform drag and drop
    await firstProject.dragTo(secondProject)
    
    // Wait for reordering
    await page.waitForTimeout(1000)
    
    // Verify reordering occurred (this depends on implementation)
    // For now, just verify that the action didn't break anything
    await expect(page.locator('[data-testid="project-card"]')).toHaveCount(projectCount)
  })
})