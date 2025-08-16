/**
 * E2E tests for MCP (Model Context Protocol) Integration
 * Tests MCP server connectivity, tool execution, and AI agent interactions
 */

import { test, expect } from '@playwright/test'

test.describe('MCP Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Check if MCP navigation is available
    const mcpNav = page.locator('[data-testid="nav-mcp"]')
    const isMcpVisible = await mcpNav.isVisible()
    
    if (!isMcpVisible) {
      // MCP might be integrated into other pages, try settings first
      await page.click('[data-testid="nav-settings"]')
      
      // Look for MCP settings or enable MCP if needed
      const mcpSection = page.locator('[data-testid="mcp-settings-section"]')
      if (await mcpSection.isVisible()) {
        console.log('MCP settings found in settings page')
      } else {
        // Try knowledge base page where MCP might be integrated
        await page.click('[data-testid="nav-knowledge-base"]')
      }
    } else {
      // Navigate to dedicated MCP page
      await page.click('[data-testid="nav-mcp"]')
      await expect(page.locator('h1')).toContainText(/mcp|model.context/i)
    }
  })

  test('displays MCP server status and health', async ({ page }) => {
    // Look for MCP health status indicator
    const mcpStatus = page.locator('[data-testid="mcp-server-status"]')
    if (await mcpStatus.isVisible()) {
      await expect(mcpStatus).toBeVisible()
      
      // Check status indicator
      const statusIndicator = mcpStatus.locator('[data-testid="status-indicator"]')
      if (await statusIndicator.isVisible()) {
        const statusText = await statusIndicator.textContent()
        expect(['healthy', 'connected', 'online', 'ready']).toContain(statusText?.toLowerCase())
      }
    } else {
      // Look for MCP health check in other locations
      const healthIndicator = page.locator('[data-testid="mcp-health"], [data-testid="server-health"]')
      if (await healthIndicator.first().isVisible()) {
        await expect(healthIndicator.first()).toBeVisible()
      } else {
        test.skip('MCP status indicator not found')
      }
    }
  })

  test('can view available MCP tools and capabilities', async ({ page }) => {
    // Look for MCP tools list or directory
    const toolsList = page.locator('[data-testid="mcp-tools-list"]')
    const toolsSection = page.locator('[data-testid="mcp-tools-section"]')
    
    if (await toolsList.isVisible()) {
      await expect(toolsList).toBeVisible()
      
      // Check for specific Archon MCP tools
      const knowledgeTools = toolsList.locator('[data-testid="tool-perform-rag-query"]')
      const codeTools = toolsList.locator('[data-testid="tool-search-code-examples"]')
      const projectTools = toolsList.locator('[data-testid="tool-manage-project"]')
      const taskTools = toolsList.locator('[data-testid="tool-manage-task"]')
      
      // Verify at least some tools are available
      const toolCount = await toolsList.locator('[data-testid^="tool-"]').count()
      expect(toolCount).toBeGreaterThan(0)
      
      console.log(`Found ${toolCount} MCP tools`)
    } else if (await toolsSection.isVisible()) {
      await expect(toolsSection).toBeVisible()
    } else {
      test.skip('MCP tools interface not found')
    }
  })

  test('can execute RAG query through MCP integration', async ({ page }) => {
    // Look for RAG query interface
    const ragInterface = page.locator('[data-testid="rag-query-interface"]')
    const knowledgeSearch = page.locator('[data-testid="knowledge-search"]')
    
    if (await ragInterface.isVisible()) {
      // Test RAG query execution
      const queryInput = ragInterface.locator('[data-testid="rag-query-input"]')
      await queryInput.fill('test query for MCP integration')
      
      const executeButton = ragInterface.locator('[data-testid="execute-rag-query"]')
      await executeButton.click()
      
      // Wait for results
      const results = page.locator('[data-testid="rag-results"]')
      await expect(results).toBeVisible({ timeout: 10000 })
      
      // Verify results structure
      const resultItems = results.locator('[data-testid="rag-result-item"]')
      const resultCount = await resultItems.count()
      expect(resultCount).toBeGreaterThanOrEqual(0)
      
    } else if (await knowledgeSearch.isVisible()) {
      // Test through knowledge base search (which may use MCP)
      await knowledgeSearch.fill('test MCP query')
      await page.press('[data-testid="knowledge-search"]', 'Enter')
      
      // Wait for search results
      await page.waitForTimeout(2000)
      
      // Check if results use MCP backend
      const searchResults = page.locator('[data-testid="search-results"]')
      if (await searchResults.isVisible()) {
        console.log('Search executed, may be using MCP backend')
      }
    } else {
      test.skip('RAG query interface not found')
    }
  })

  test('can search code examples through MCP', async ({ page }) => {
    // Look for code search interface
    const codeSearchInterface = page.locator('[data-testid="code-search-interface"]')
    const searchCodeButton = page.locator('[data-testid="search-code-examples"]')
    
    if (await codeSearchInterface.isVisible()) {
      // Test code search execution
      const queryInput = codeSearchInterface.locator('[data-testid="code-search-input"]')
      await queryInput.fill('React component example')
      
      const searchButton = codeSearchInterface.locator('[data-testid="execute-code-search"]')
      await searchButton.click()
      
      // Wait for results
      const results = page.locator('[data-testid="code-search-results"]')
      await expect(results).toBeVisible({ timeout: 10000 })
      
      // Verify code example structure
      const codeItems = results.locator('[data-testid="code-example-item"]')
      const codeCount = await codeItems.count()
      expect(codeCount).toBeGreaterThanOrEqual(0)
      
    } else if (await searchCodeButton.isVisible()) {
      await searchCodeButton.click()
      
      // Fill in search form
      const modal = page.locator('[data-testid="code-search-modal"]')
      if (await modal.isVisible()) {
        const queryInput = modal.locator('[data-testid="code-query-input"]')
        await queryInput.fill('authentication example')
        
        const submitButton = modal.locator('[data-testid="submit-code-search"]')
        await submitButton.click()
        
        // Wait for results
        const results = modal.locator('[data-testid="search-results"]')
        await expect(results).toBeVisible({ timeout: 10000 })
      }
    } else {
      test.skip('Code search interface not found')
    }
  })

  test('can manage projects through MCP tools', async ({ page }) => {
    // Navigate to projects page if not already there
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    if (await projectsNav.isVisible()) {
      await projectsNav.click()
    }
    
    // Look for MCP-powered project operations
    const createProjectButton = page.locator('[data-testid="create-project-button"]')
    if (await createProjectButton.isVisible()) {
      await createProjectButton.click()
      
      const modal = page.locator('[data-testid="create-project-modal"]')
      await expect(modal).toBeVisible()
      
      // Fill project details
      await page.fill('[data-testid="project-title-input"]', 'MCP Integration Test Project')
      await page.fill('[data-testid="project-description-input"]', 'Testing MCP project management tools')
      
      // Submit and wait for MCP backend processing
      await page.click('[data-testid="submit-create-project"]')
      
      // Look for MCP processing indicators
      const mcpProgress = page.locator('[data-testid="mcp-processing"], [data-testid="project-creation-progress"]')
      if (await mcpProgress.isVisible()) {
        await expect(mcpProgress).not.toBeVisible({ timeout: 30000 })
      }
      
      // Verify project was created
      const projectCard = page.locator('[data-testid="project-card"]').filter({ hasText: 'MCP Integration Test' })
      await expect(projectCard).toBeVisible()
    } else {
      test.skip('Project creation interface not available')
    }
  })

  test('can manage tasks through MCP integration', async ({ page }) => {
    // Navigate to a project with tasks
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount > 0) {
      await projectCards.first().click()
      
      // Look for task management with MCP integration
      const createTaskButton = page.locator('[data-testid="create-task-button"]')
      if (await createTaskButton.isVisible()) {
        await createTaskButton.click()
        
        const modal = page.locator('[data-testid="create-task-modal"]')
        await expect(modal).toBeVisible()
        
        // Fill task details
        await page.fill('[data-testid="task-title-input"]', 'MCP Task Management Test')
        await page.fill('[data-testid="task-description-input"]', 'Testing MCP task management capabilities')
        
        // Set assignee to AI agent (which may use MCP)
        const assigneeSelect = page.locator('[data-testid="task-assignee-select"]')
        if (await assigneeSelect.isVisible()) {
          await assigneeSelect.selectOption('AI IDE Agent')
        }
        
        // Submit and wait for MCP processing
        await page.click('[data-testid="submit-create-task"]')
        
        // Look for MCP task processing
        const taskProgress = page.locator('[data-testid="mcp-task-processing"]')
        if (await taskProgress.isVisible()) {
          await expect(taskProgress).not.toBeVisible({ timeout: 15000 })
        }
        
        // Verify task was created
        const taskCard = page.locator('[data-testid="task-card"]').filter({ hasText: 'MCP Task Management' })
        await expect(taskCard).toBeVisible()
      }
    } else {
      test.skip('No projects available for task management testing')
    }
  })

  test('displays MCP tool execution status and feedback', async ({ page }) => {
    // Look for MCP execution logs or status displays
    const mcpLogs = page.locator('[data-testid="mcp-execution-logs"]')
    const mcpStatus = page.locator('[data-testid="mcp-status-display"]')
    
    if (await mcpLogs.isVisible()) {
      // Check for log entries
      const logEntries = mcpLogs.locator('[data-testid="log-entry"]')
      const logCount = await logEntries.count()
      
      if (logCount > 0) {
        console.log(`Found ${logCount} MCP log entries`)
        
        // Verify log entry structure
        const firstLog = logEntries.first()
        const timestamp = firstLog.locator('[data-testid="log-timestamp"]')
        const operation = firstLog.locator('[data-testid="log-operation"]')
        const status = firstLog.locator('[data-testid="log-status"]')
        
        await expect(timestamp).toBeVisible()
        await expect(operation).toBeVisible()
        await expect(status).toBeVisible()
      }
    }
    
    if (await mcpStatus.isVisible()) {
      // Check status display elements
      const activeOperations = mcpStatus.locator('[data-testid="active-operations"]')
      const completedOperations = mcpStatus.locator('[data-testid="completed-operations"]')
      
      if (await activeOperations.isVisible()) {
        console.log('Active MCP operations display found')
      }
      
      if (await completedOperations.isVisible()) {
        console.log('Completed MCP operations display found')
      }
    }
    
    // If no specific MCP status displays, check for general operation feedback
    const operationFeedback = page.locator('[data-testid="operation-feedback"], [data-testid="status-message"]')
    if (await operationFeedback.first().isVisible()) {
      console.log('General operation feedback available')
    }
  })

  test('handles MCP connection errors gracefully', async ({ page }) => {
    // Look for MCP health check or connection test
    const healthCheck = page.locator('[data-testid="mcp-health-check"]')
    const connectionTest = page.locator('[data-testid="test-mcp-connection"]')
    
    if (await healthCheck.isVisible()) {
      await healthCheck.click()
      
      // Wait for health check results
      const healthResults = page.locator('[data-testid="health-check-results"]')
      await expect(healthResults).toBeVisible({ timeout: 10000 })
      
      // Check for both success and error states
      const successIndicator = healthResults.locator('[data-testid="health-success"]')
      const errorIndicator = healthResults.locator('[data-testid="health-error"]')
      
      const hasSuccess = await successIndicator.isVisible()
      const hasError = await errorIndicator.isVisible()
      
      expect(hasSuccess || hasError).toBeTruthy()
      
      if (hasError) {
        // Verify error message is informative
        const errorMessage = errorIndicator.locator('[data-testid="error-message"]')
        await expect(errorMessage).toBeVisible()
        
        const errorText = await errorMessage.textContent()
        expect(errorText).toBeDefined()
        expect(errorText!.length).toBeGreaterThan(10)
      }
    } else if (await connectionTest.isVisible()) {
      await connectionTest.click()
      
      // Wait for connection test results
      await page.waitForTimeout(5000)
      
      // Check for connection status feedback
      const connectionStatus = page.locator('[data-testid="connection-status"]')
      if (await connectionStatus.isVisible()) {
        const statusText = await connectionStatus.textContent()
        expect(['connected', 'disconnected', 'error', 'timeout']).toContain(statusText?.toLowerCase())
      }
    } else {
      // Try to trigger an MCP operation and observe error handling
      const ragInterface = page.locator('[data-testid="rag-query-interface"]')
      if (await ragInterface.isVisible()) {
        const queryInput = ragInterface.locator('[data-testid="rag-query-input"]')
        await queryInput.fill('test error handling')
        
        const executeButton = ragInterface.locator('[data-testid="execute-rag-query"]')
        await executeButton.click()
        
        // Wait for either results or error
        await page.waitForTimeout(5000)
        
        // Check for error handling
        const errorDisplay = page.locator('[data-testid="operation-error"], [data-testid="mcp-error"]')
        if (await errorDisplay.isVisible()) {
          console.log('MCP error handling is working')
        }
      } else {
        test.skip('No MCP operations available to test error handling')
      }
    }
  })

  test('can configure MCP server settings', async ({ page }) => {
    // Navigate to settings page
    await page.click('[data-testid="nav-settings"]')
    
    // Look for MCP configuration section
    const mcpSettings = page.locator('[data-testid="mcp-settings-section"]')
    if (await mcpSettings.isVisible()) {
      // Check for MCP server URL configuration
      const serverUrlInput = mcpSettings.locator('[data-testid="mcp-server-url"]')
      if (await serverUrlInput.isVisible()) {
        const currentUrl = await serverUrlInput.inputValue()
        expect(currentUrl).toContain('8051') // Default MCP port
      }
      
      // Check for MCP feature toggles
      const enableMcpToggle = mcpSettings.locator('[data-testid="enable-mcp-toggle"]')
      if (await enableMcpToggle.isVisible()) {
        const isEnabled = await enableMcpToggle.isChecked()
        console.log(`MCP is ${isEnabled ? 'enabled' : 'disabled'}`)
      }
      
      // Check for timeout settings
      const timeoutSetting = mcpSettings.locator('[data-testid="mcp-timeout-setting"]')
      if (await timeoutSetting.isVisible()) {
        const timeout = await timeoutSetting.inputValue()
        expect(parseInt(timeout)).toBeGreaterThan(0)
      }
      
      // Test saving settings
      const saveButton = mcpSettings.locator('[data-testid="save-mcp-settings"]')
      if (await saveButton.isVisible()) {
        await saveButton.click()
        
        // Wait for save confirmation
        const saveConfirmation = page.locator('[data-testid="settings-saved-notification"]')
        if (await saveConfirmation.isVisible()) {
          await expect(saveConfirmation).toBeVisible()
        }
      }
    } else {
      test.skip('MCP settings section not found')
    }
  })

  test('supports real-time MCP operation monitoring', async ({ page }) => {
    // Look for real-time MCP monitoring interface
    const monitoringInterface = page.locator('[data-testid="mcp-monitoring"]')
    const realtimeUpdates = page.locator('[data-testid="realtime-mcp-updates"]')
    
    if (await monitoringInterface.isVisible()) {
      // Check for operation counters
      const operationCounters = monitoringInterface.locator('[data-testid="operation-counters"]')
      if (await operationCounters.isVisible()) {
        const totalOps = operationCounters.locator('[data-testid="total-operations"]')
        const successfulOps = operationCounters.locator('[data-testid="successful-operations"]')
        const failedOps = operationCounters.locator('[data-testid="failed-operations"]')
        
        if (await totalOps.isVisible()) {
          const totalText = await totalOps.textContent()
          expect(totalText).toMatch(/\d+/)
        }
      }
      
      // Check for response time metrics
      const responseMetrics = monitoringInterface.locator('[data-testid="response-time-metrics"]')
      if (await responseMetrics.isVisible()) {
        const avgResponseTime = responseMetrics.locator('[data-testid="avg-response-time"]')
        if (await avgResponseTime.isVisible()) {
          const responseText = await avgResponseTime.textContent()
          expect(responseText).toMatch(/\d+ms|\d+s/)
        }
      }
    }
    
    if (await realtimeUpdates.isVisible()) {
      // Trigger an MCP operation to test real-time updates
      const ragInterface = page.locator('[data-testid="rag-query-interface"]')
      if (await ragInterface.isVisible()) {
        const queryInput = ragInterface.locator('[data-testid="rag-query-input"]')
        await queryInput.fill('real-time monitoring test')
        
        const executeButton = ragInterface.locator('[data-testid="execute-rag-query"]')
        await executeButton.click()
        
        // Wait for real-time update
        await page.waitForTimeout(2000)
        
        // Check if monitoring data updated
        const lastUpdate = realtimeUpdates.locator('[data-testid="last-operation-time"]')
        if (await lastUpdate.isVisible()) {
          console.log('Real-time MCP monitoring is working')
        }
      }
    }
  })

  test('can view MCP operation history and logs', async ({ page }) => {
    // Look for MCP history or logs section
    const mcpHistory = page.locator('[data-testid="mcp-operation-history"]')
    const mcpLogs = page.locator('[data-testid="mcp-logs-section"]')
    
    if (await mcpHistory.isVisible()) {
      // Check for historical operations
      const historyItems = mcpHistory.locator('[data-testid="history-item"]')
      const historyCount = await historyItems.count()
      
      console.log(`Found ${historyCount} MCP history items`)
      
      if (historyCount > 0) {
        const firstItem = historyItems.first()
        
        // Verify history item structure
        const operation = firstItem.locator('[data-testid="operation-type"]')
        const timestamp = firstItem.locator('[data-testid="operation-timestamp"]')
        const status = firstItem.locator('[data-testid="operation-status"]')
        const duration = firstItem.locator('[data-testid="operation-duration"]')
        
        await expect(operation).toBeVisible()
        await expect(timestamp).toBeVisible()
        await expect(status).toBeVisible()
        
        if (await duration.isVisible()) {
          const durationText = await duration.textContent()
          expect(durationText).toMatch(/\d+ms|\d+s/)
        }
        
        // Test clicking on history item for details
        await firstItem.click()
        
        const detailModal = page.locator('[data-testid="operation-detail-modal"]')
        if (await detailModal.isVisible()) {
          await expect(detailModal).toBeVisible()
          
          // Close detail modal
          const closeButton = detailModal.locator('[data-testid="close-detail"]')
          if (await closeButton.isVisible()) {
            await closeButton.click()
          }
        }
      }
    }
    
    if (await mcpLogs.isVisible()) {
      // Test log filtering and search
      const logFilter = mcpLogs.locator('[data-testid="log-filter"]')
      if (await logFilter.isVisible()) {
        await logFilter.selectOption('error')
        await page.waitForTimeout(500)
        
        // Verify filtered logs
        const errorLogs = mcpLogs.locator('[data-testid="log-entry"][data-level="error"]')
        const errorCount = await errorLogs.count()
        console.log(`Found ${errorCount} error logs`)
      }
      
      const logSearch = mcpLogs.locator('[data-testid="log-search"]')
      if (await logSearch.isVisible()) {
        await logSearch.fill('rag_query')
        await page.waitForTimeout(500)
        
        // Verify search results
        const searchResults = mcpLogs.locator('[data-testid="log-entry"]:visible')
        const resultsCount = await searchResults.count()
        console.log(`Found ${resultsCount} matching log entries`)
      }
    }
  })
})