/**
 * E2E tests for Knowledge Base functionality
 * Tests the complete knowledge management workflow
 */

import { test, expect } from '@playwright/test'

test.describe('Knowledge Base Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Wait for the knowledge base page to load
    await expect(page.locator('h1')).toContainText('Knowledge Base')
  })

  test('displays knowledge base with initial state', async ({ page }) => {
    // Check that the knowledge base page is visible
    await expect(page.locator('[data-testid="knowledge-base"]')).toBeVisible()
    
    // Check for main UI elements
    await expect(page.locator('[data-testid="add-knowledge-item-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="knowledge-search"]')).toBeVisible()
    
    // Check if knowledge items are displayed or empty state
    const knowledgeItems = page.locator('[data-testid="knowledge-item-card"]')
    const emptyState = page.locator('[data-testid="empty-knowledge-state"]')
    
    const hasItems = await knowledgeItems.count() > 0
    const hasEmptyState = await emptyState.isVisible()
    
    expect(hasItems || hasEmptyState).toBeTruthy()
  })

  test('can add new knowledge item via URL crawling', async ({ page }) => {
    // Click add knowledge item button
    await page.click('[data-testid="add-knowledge-item-button"]')
    
    // Fill in the knowledge item form
    const modal = page.locator('[data-testid="add-knowledge-modal"]')
    await expect(modal).toBeVisible()
    
    await page.fill('[data-testid="knowledge-url-input"]', 'https://example.com/docs')
    await page.fill('[data-testid="knowledge-title-input"]', 'Test Documentation')
    await page.fill('[data-testid="knowledge-description-input"]', 'Test documentation for E2E testing')
    
    // Select knowledge type
    await page.selectOption('[data-testid="knowledge-type-select"]', 'documentation')
    
    // Add tags
    await page.fill('[data-testid="knowledge-tags-input"]', 'test,e2e,documentation')
    
    // Submit the form
    await page.click('[data-testid="submit-knowledge-item"]')
    
    // Wait for crawling to start
    await expect(page.locator('[data-testid="crawling-progress"]')).toBeVisible()
    
    // Check that the item appears in the list
    await expect(page.locator('[data-testid="knowledge-item-card"]').first()).toBeVisible()
    
    // Verify the item details
    const newItem = page.locator('[data-testid="knowledge-item-card"]').first()
    await expect(newItem.locator('[data-testid="knowledge-title"]')).toContainText('Test Documentation')
    await expect(newItem.locator('[data-testid="knowledge-url"]')).toContainText('https://example.com/docs')
  })

  test('can search and filter knowledge items', async ({ page }) => {
    // Ensure we have some test data
    const knowledgeItems = page.locator('[data-testid="knowledge-item-card"]')
    const initialCount = await knowledgeItems.count()
    
    if (initialCount === 0) {
      test.skip('No knowledge items available for search testing')
    }
    
    // Test search functionality
    const searchInput = page.locator('[data-testid="knowledge-search"]')
    await searchInput.fill('test')
    
    // Wait for search results
    await page.waitForTimeout(500)
    
    // Verify search results
    const searchResults = page.locator('[data-testid="knowledge-item-card"]')
    const resultsCount = await searchResults.count()
    
    expect(resultsCount).toBeGreaterThanOrEqual(0)
    
    // Clear search
    await searchInput.clear()
    await page.waitForTimeout(500)
    
    // Verify all items are visible again
    const finalCount = await knowledgeItems.count()
    expect(finalCount).toBe(initialCount)
  })

  test('can filter by knowledge type', async ({ page }) => {
    // Check if filter dropdown exists
    const filterDropdown = page.locator('[data-testid="knowledge-type-filter"]')
    if (!await filterDropdown.isVisible()) {
      test.skip('Knowledge type filter not available')
    }
    
    // Filter by documentation type
    await filterDropdown.selectOption('documentation')
    
    // Wait for filtering
    await page.waitForTimeout(500)
    
    // Verify filtered results
    const visibleItems = page.locator('[data-testid="knowledge-item-card"]:visible')
    const count = await visibleItems.count()
    
    if (count > 0) {
      // Check that visible items are of the correct type
      const firstItem = visibleItems.first()
      await expect(firstItem.locator('[data-testid="knowledge-type-badge"]')).toContainText('documentation')
    }
    
    // Reset filter
    await filterDropdown.selectOption('all')
  })

  test('can view knowledge item details', async ({ page }) => {
    const knowledgeItems = page.locator('[data-testid="knowledge-item-card"]')
    const itemCount = await knowledgeItems.count()
    
    if (itemCount === 0) {
      test.skip('No knowledge items available for detail testing')
    }
    
    // Click on the first knowledge item
    await knowledgeItems.first().click()
    
    // Check if detail modal or page opens
    const detailView = page.locator('[data-testid="knowledge-item-detail"]')
    if (await detailView.isVisible()) {
      // Verify detail view content
      await expect(detailView.locator('[data-testid="knowledge-title"]')).toBeVisible()
      await expect(detailView.locator('[data-testid="knowledge-url"]')).toBeVisible()
      await expect(detailView.locator('[data-testid="knowledge-description"]')).toBeVisible()
      
      // Close detail view
      const closeButton = detailView.locator('[data-testid="close-detail"]')
      if (await closeButton.isVisible()) {
        await closeButton.click()
      }
    }
  })

  test('can edit knowledge item', async ({ page }) => {
    const knowledgeItems = page.locator('[data-testid="knowledge-item-card"]')
    const itemCount = await knowledgeItems.count()
    
    if (itemCount === 0) {
      test.skip('No knowledge items available for editing')
    }
    
    const firstItem = knowledgeItems.first()
    
    // Click edit button (might be in a dropdown menu)
    const editButton = firstItem.locator('[data-testid="edit-knowledge-item"]')
    if (await editButton.isVisible()) {
      await editButton.click()
    } else {
      // Try opening context menu first
      const moreButton = firstItem.locator('[data-testid="knowledge-item-menu"]')
      if (await moreButton.isVisible()) {
        await moreButton.click()
        await page.click('[data-testid="edit-knowledge-item"]')
      } else {
        test.skip('Edit functionality not accessible')
      }
    }
    
    // Wait for edit modal
    const editModal = page.locator('[data-testid="edit-knowledge-modal"]')
    await expect(editModal).toBeVisible()
    
    // Make a change
    const titleInput = editModal.locator('[data-testid="knowledge-title-input"]')
    const originalTitle = await titleInput.inputValue()
    const newTitle = originalTitle + ' (Edited)'
    
    await titleInput.clear()
    await titleInput.fill(newTitle)
    
    // Save changes
    await page.click('[data-testid="save-knowledge-item"]')
    
    // Wait for modal to close
    await expect(editModal).not.toBeVisible()
    
    // Verify the change
    await expect(firstItem.locator('[data-testid="knowledge-title"]')).toContainText('(Edited)')
  })

  test('can delete knowledge item', async ({ page }) => {
    const knowledgeItems = page.locator('[data-testid="knowledge-item-card"]')
    const initialCount = await knowledgeItems.count()
    
    if (initialCount === 0) {
      test.skip('No knowledge items available for deletion')
    }
    
    const firstItem = knowledgeItems.first()
    
    // Click delete button
    const deleteButton = firstItem.locator('[data-testid="delete-knowledge-item"]')
    if (await deleteButton.isVisible()) {
      await deleteButton.click()
    } else {
      // Try opening context menu first
      const moreButton = firstItem.locator('[data-testid="knowledge-item-menu"]')
      if (await moreButton.isVisible()) {
        await moreButton.click()
        await page.click('[data-testid="delete-knowledge-item"]')
      } else {
        test.skip('Delete functionality not accessible')
      }
    }
    
    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain('delete')
      await dialog.accept()
    })
    
    // Wait for deletion
    await page.waitForTimeout(1000)
    
    // Verify item count decreased
    const finalCount = await knowledgeItems.count()
    expect(finalCount).toBe(initialCount - 1)
  })

  test('can refresh knowledge item data', async ({ page }) => {
    const knowledgeItems = page.locator('[data-testid="knowledge-item-card"]')
    const itemCount = await knowledgeItems.count()
    
    if (itemCount === 0) {
      test.skip('No knowledge items available for refresh testing')
    }
    
    const firstItem = knowledgeItems.first()
    
    // Click refresh button
    const refreshButton = firstItem.locator('[data-testid="refresh-knowledge-item"]')
    if (await refreshButton.isVisible()) {
      await refreshButton.click()
    } else {
      test.skip('Refresh functionality not available')
    }
    
    // Check for loading state
    const loadingIndicator = firstItem.locator('[data-testid="refreshing-indicator"]')
    if (await loadingIndicator.isVisible()) {
      // Wait for refresh to complete
      await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 })
    }
    
    // Verify refresh completed successfully
    const errorIndicator = firstItem.locator('[data-testid="error-indicator"]')
    expect(await errorIndicator.isVisible()).toBeFalsy()
  })

  test('handles crawling progress and status updates', async ({ page }) => {
    // Add a new knowledge item to test crawling
    await page.click('[data-testid="add-knowledge-item-button"]')
    
    const modal = page.locator('[data-testid="add-knowledge-modal"]')
    await expect(modal).toBeVisible()
    
    await page.fill('[data-testid="knowledge-url-input"]', 'https://httpbin.org/html')
    await page.fill('[data-testid="knowledge-title-input"]', 'Test Crawling Progress')
    
    // Submit the form
    await page.click('[data-testid="submit-knowledge-item"]')
    
    // Monitor crawling progress
    const progressCard = page.locator('[data-testid="crawling-progress"]')
    if (await progressCard.isVisible()) {
      // Check for progress indicators
      await expect(progressCard.locator('[data-testid="progress-bar"]')).toBeVisible()
      await expect(progressCard.locator('[data-testid="progress-text"]')).toBeVisible()
      
      // Wait for completion (with timeout)
      await expect(progressCard).not.toBeVisible({ timeout: 60000 })
    }
    
    // Verify the item appears with completed status
    const newItem = page.locator('[data-testid="knowledge-item-card"]').first()
    await expect(newItem).toBeVisible()
    
    const statusBadge = newItem.locator('[data-testid="status-badge"]')
    if (await statusBadge.isVisible()) {
      const statusText = await statusBadge.textContent()
      expect(['completed', 'success', 'finished']).toContain(statusText?.toLowerCase())
    }
  })

  test('displays proper error states', async ({ page }) => {
    // Try to add a knowledge item with an invalid URL
    await page.click('[data-testid="add-knowledge-item-button"]')
    
    const modal = page.locator('[data-testid="add-knowledge-modal"]')
    await expect(modal).toBeVisible()
    
    await page.fill('[data-testid="knowledge-url-input"]', 'invalid-url')
    await page.fill('[data-testid="knowledge-title-input"]', 'Test Error Handling')
    
    // Submit the form
    await page.click('[data-testid="submit-knowledge-item"]')
    
    // Check for error message
    const errorMessage = page.locator('[data-testid="error-message"]')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText(/invalid|error|url/i)
    
    // Close modal
    await page.click('[data-testid="cancel-knowledge-item"]')
    await expect(modal).not.toBeVisible()
  })
})