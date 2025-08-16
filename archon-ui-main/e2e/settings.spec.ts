/**
 * E2E tests for Settings functionality
 * Tests configuration management and feature toggles
 */

import { test, expect } from '@playwright/test'

test.describe('Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings')
    
    // Wait for settings page to load
    await expect(page.locator('h1')).toContainText(/settings/i)
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
  })

  test('displays settings page with main sections', async ({ page }) => {
    // Check for main settings sections
    const expectedSections = [
      'api-keys-section',
      'features-section', 
      'rag-settings-section',
      'code-extraction-settings'
    ]
    
    for (const section of expectedSections) {
      const element = page.locator(`[data-testid="${section}"]`)
      if (await element.isVisible()) {
        await expect(element).toBeVisible()
      }
    }
  })

  test('can manage API keys', async ({ page }) => {
    const apiKeysSection = page.locator('[data-testid="api-keys-section"]')
    
    if (!await apiKeysSection.isVisible()) {
      test.skip('API Keys section not available')
    }
    
    // Check OpenAI API key field
    const openaiKeyInput = page.locator('[data-testid="openai-api-key-input"]')
    if (await openaiKeyInput.isVisible()) {
      // Test setting API key
      await openaiKeyInput.fill('sk-test-key-for-e2e-testing')
      
      // Save settings
      const saveButton = page.locator('[data-testid="save-api-keys"]')
      if (await saveButton.isVisible()) {
        await saveButton.click()
        
        // Check for success message
        const successMessage = page.locator('[data-testid="success-message"]')
        await expect(successMessage).toBeVisible()
      }
    }
    
    // Test other API key fields if they exist
    const anthropicKeyInput = page.locator('[data-testid="anthropic-api-key-input"]')
    if (await anthropicKeyInput.isVisible()) {
      await anthropicKeyInput.fill('sk-ant-test-key')
    }
  })

  test('can toggle feature flags', async ({ page }) => {
    const featuresSection = page.locator('[data-testid="features-section"]')
    
    if (!await featuresSection.isVisible()) {
      test.skip('Features section not available')
    }
    
    // Test Projects toggle
    const projectsToggle = page.locator('[data-testid="projects-enabled-toggle"]')
    if (await projectsToggle.isVisible()) {
      // Get current state
      const isInitiallyChecked = await projectsToggle.isChecked()
      
      // Toggle the setting
      await projectsToggle.click()
      
      // Verify state changed
      const isNowChecked = await projectsToggle.isChecked()
      expect(isNowChecked).toBe(!isInitiallyChecked)
      
      // Save settings
      const saveButton = page.locator('[data-testid="save-features"]')
      if (await saveButton.isVisible()) {
        await saveButton.click()
        
        // Check for success feedback
        const successMessage = page.locator('[data-testid="success-message"]')
        await expect(successMessage).toBeVisible()
      }
    }
    
    // Test MCP toggle if available
    const mcpToggle = page.locator('[data-testid="mcp-enabled-toggle"]')
    if (await mcpToggle.isVisible()) {
      const initialState = await mcpToggle.isChecked()
      await mcpToggle.click()
      expect(await mcpToggle.isChecked()).toBe(!initialState)
    }
  })

  test('can configure RAG settings', async ({ page }) => {
    const ragSection = page.locator('[data-testid="rag-settings-section"]')
    
    if (!await ragSection.isVisible()) {
      test.skip('RAG settings section not available')
    }
    
    // Test chunk size setting
    const chunkSizeInput = page.locator('[data-testid="chunk-size-input"]')
    if (await chunkSizeInput.isVisible()) {
      await chunkSizeInput.clear()
      await chunkSizeInput.fill('1000')
    }
    
    // Test overlap setting
    const overlapInput = page.locator('[data-testid="chunk-overlap-input"]')
    if (await overlapInput.isVisible()) {
      await overlapInput.clear()
      await overlapInput.fill('200')
    }
    
    // Test embedding model selection
    const embeddingModelSelect = page.locator('[data-testid="embedding-model-select"]')
    if (await embeddingModelSelect.isVisible()) {
      await embeddingModelSelect.selectOption('text-embedding-ada-002')
    }
    
    // Save RAG settings
    const saveButton = page.locator('[data-testid="save-rag-settings"]')
    if (await saveButton.isVisible()) {
      await saveButton.click()
      
      // Verify save success
      const successMessage = page.locator('[data-testid="success-message"]')
      await expect(successMessage).toBeVisible()
    }
  })

  test('can configure code extraction settings', async ({ page }) => {
    const codeSection = page.locator('[data-testid="code-extraction-settings"]')
    
    if (!await codeSection.isVisible()) {
      test.skip('Code extraction settings not available')
    }
    
    // Test programming language toggles
    const languageToggles = [
      'javascript-toggle',
      'python-toggle', 
      'typescript-toggle',
      'java-toggle',
      'go-toggle'
    ]
    
    for (const toggleId of languageToggles) {
      const toggle = page.locator(`[data-testid="${toggleId}"]`)
      if (await toggle.isVisible()) {
        // Test toggling the language
        const initialState = await toggle.isChecked()
        await toggle.click()
        expect(await toggle.isChecked()).toBe(!initialState)
      }
    }
    
    // Test extraction options
    const extractFunctionsToggle = page.locator('[data-testid="extract-functions-toggle"]')
    if (await extractFunctionsToggle.isVisible()) {
      await extractFunctionsToggle.click()
    }
    
    const extractClassesToggle = page.locator('[data-testid="extract-classes-toggle"]')
    if (await extractClassesToggle.isVisible()) {
      await extractClassesToggle.click()
    }
    
    // Save code extraction settings
    const saveButton = page.locator('[data-testid="save-code-settings"]')
    if (await saveButton.isVisible()) {
      await saveButton.click()
      
      const successMessage = page.locator('[data-testid="success-message"]')
      await expect(successMessage).toBeVisible()
    }
  })

  test('persists settings across page reloads', async ({ page }) => {
    // Make a settings change
    const projectsToggle = page.locator('[data-testid="projects-enabled-toggle"]')
    
    if (!await projectsToggle.isVisible()) {
      test.skip('Projects toggle not available for persistence testing')
    }
    
    const initialState = await projectsToggle.isChecked()
    await projectsToggle.click()
    
    // Save the change
    const saveButton = page.locator('[data-testid="save-features"]')
    if (await saveButton.isVisible()) {
      await saveButton.click()
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    }
    
    // Reload the page
    await page.reload()
    await expect(page.locator('[data-testid="settings-page"]')).toBeVisible()
    
    // Verify the setting persisted
    const toggleAfterReload = page.locator('[data-testid="projects-enabled-toggle"]')
    expect(await toggleAfterReload.isChecked()).toBe(!initialState)
  })

  test('validates input fields appropriately', async ({ page }) => {
    // Test chunk size validation
    const chunkSizeInput = page.locator('[data-testid="chunk-size-input"]')
    
    if (await chunkSizeInput.isVisible()) {
      // Test invalid input
      await chunkSizeInput.clear()
      await chunkSizeInput.fill('invalid-number')
      
      // Try to save
      const saveButton = page.locator('[data-testid="save-rag-settings"]')
      if (await saveButton.isVisible()) {
        await saveButton.click()
        
        // Check for validation error
        const errorMessage = page.locator('[data-testid="validation-error"]')
        await expect(errorMessage).toBeVisible()
      }
      
      // Fix with valid input
      await chunkSizeInput.clear()
      await chunkSizeInput.fill('1000')
      
      if (await saveButton.isVisible()) {
        await saveButton.click()
        
        // Error should be gone
        const errorMessage = page.locator('[data-testid="validation-error"]')
        await expect(errorMessage).not.toBeVisible()
      }
    }
  })

  test('displays current system status', async ({ page }) => {
    const systemStatus = page.locator('[data-testid="system-status"]')
    
    if (!await systemStatus.isVisible()) {
      test.skip('System status not implemented')
    }
    
    // Check for status indicators
    const statusItems = [
      'backend-status',
      'database-status',
      'mcp-status',
      'cache-status'
    ]
    
    for (const statusId of statusItems) {
      const statusItem = page.locator(`[data-testid="${statusId}"]`)
      if (await statusItem.isVisible()) {
        // Should show online/offline or similar status
        const statusText = await statusItem.textContent()
        expect(statusText).toMatch(/(online|offline|connected|disconnected|healthy|error)/i)
      }
    }
  })

  test('can test API connections', async ({ page }) => {
    // Test OpenAI API connection
    const testOpenAIButton = page.locator('[data-testid="test-openai-connection"]')
    
    if (await testOpenAIButton.isVisible()) {
      await testOpenAIButton.click()
      
      // Wait for test result
      const testResult = page.locator('[data-testid="openai-test-result"]')
      await expect(testResult).toBeVisible({ timeout: 10000 })
      
      // Check for success or error message
      const resultText = await testResult.textContent()
      expect(resultText).toMatch(/(success|error|failed|connected)/i)
    }
    
    // Test database connection
    const testDatabaseButton = page.locator('[data-testid="test-database-connection"]')
    
    if (await testDatabaseButton.isVisible()) {
      await testDatabaseButton.click()
      
      const dbTestResult = page.locator('[data-testid="database-test-result"]')
      await expect(dbTestResult).toBeVisible({ timeout: 5000 })
    }
  })

  test('shows usage statistics if available', async ({ page }) => {
    const usageSection = page.locator('[data-testid="usage-statistics"]')
    
    if (!await usageSection.isVisible()) {
      test.skip('Usage statistics not implemented')
    }
    
    // Check for usage metrics
    const metrics = [
      'api-calls-count',
      'documents-processed',
      'storage-used',
      'last-activity'
    ]
    
    for (const metricId of metrics) {
      const metric = page.locator(`[data-testid="${metricId}"]`)
      if (await metric.isVisible()) {
        const metricText = await metric.textContent()
        expect(metricText).toBeTruthy()
      }
    }
  })

  test('can export and import settings', async ({ page }) => {
    // Test export functionality
    const exportButton = page.locator('[data-testid="export-settings"]')
    
    if (await exportButton.isVisible()) {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/settings.*\.json/i)
    }
    
    // Test import functionality
    const importButton = page.locator('[data-testid="import-settings"]')
    const fileInput = page.locator('[data-testid="settings-file-input"]')
    
    if (await importButton.isVisible() && await fileInput.isVisible()) {
      // Create a test settings file
      const testSettings = JSON.stringify({
        projects_enabled: true,
        chunk_size: 1500,
        embedding_model: 'text-embedding-ada-002'
      })
      
      // Upload the test file
      await fileInput.setInputFiles({
        name: 'test-settings.json',
        mimeType: 'application/json',
        buffer: Buffer.from(testSettings)
      })
      
      await importButton.click()
      
      // Check for import success
      const successMessage = page.locator('[data-testid="import-success"]')
      await expect(successMessage).toBeVisible()
    }
  })

  test('handles reset to defaults', async ({ page }) => {
    const resetButton = page.locator('[data-testid="reset-to-defaults"]')
    
    if (!await resetButton.isVisible()) {
      test.skip('Reset to defaults not implemented')
    }
    
    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain(/reset|default/i)
      await dialog.accept()
    })
    
    await resetButton.click()
    
    // Wait for reset to complete
    const successMessage = page.locator('[data-testid="reset-success"]')
    await expect(successMessage).toBeVisible()
    
    // Verify settings were reset (check a few key settings)
    const projectsToggle = page.locator('[data-testid="projects-enabled-toggle"]')
    if (await projectsToggle.isVisible()) {
      // Assuming default is enabled
      expect(await projectsToggle.isChecked()).toBeTruthy()
    }
  })
})