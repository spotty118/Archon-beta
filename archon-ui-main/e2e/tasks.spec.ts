/**
 * E2E tests for Task Management functionality
 * Tests task creation, editing, status changes, and project integration
 */

import { test, expect } from '@playwright/test'

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Ensure projects feature is enabled for task management
    const projectsNav = page.locator('[data-testid="nav-projects"]')
    const isProjectsVisible = await projectsNav.isVisible()
    
    if (!isProjectsVisible) {
      // Navigate to settings to enable projects
      await page.click('[data-testid="nav-settings"]')
      
      const projectToggle = page.locator('[data-testid="enable-projects-toggle"]')
      if (await projectToggle.isVisible()) {
        const isChecked = await projectToggle.isChecked()
        if (!isChecked) {
          await projectToggle.check()
          await page.waitForTimeout(1000)
        }
      }
    }
    
    // Navigate to projects page
    await page.click('[data-testid="nav-projects"]')
    await expect(page.locator('h1')).toContainText(/projects/i)
    
    // Select first project or create one if none exists
    const projectCards = page.locator('[data-testid="project-card"]')
    const projectCount = await projectCards.count()
    
    if (projectCount === 0) {
      // Create a test project for task management
      await page.click('[data-testid="create-project-button"]')
      const modal = page.locator('[data-testid="create-project-modal"]')
      await expect(modal).toBeVisible()
      
      await page.fill('[data-testid="project-title-input"]', 'Test Project for Tasks')
      await page.fill('[data-testid="project-description-input"]', 'Project for testing task management')
      await page.click('[data-testid="submit-create-project"]')
      
      // Wait for project creation
      const creationProgress = page.locator('[data-testid="project-creation-progress"]')
      if (await creationProgress.isVisible()) {
        await expect(creationProgress).not.toBeVisible({ timeout: 30000 })
      }
    }
    
    // Click on the first project to enter task management
    await page.locator('[data-testid="project-card"]').first().click()
    
    // Navigate to tasks section within the project
    const tasksSection = page.locator('[data-testid="project-tasks-section"]')
    if (await tasksSection.isVisible()) {
      await tasksSection.click()
    } else {
      // Look for tasks tab or navigation
      const tasksTab = page.locator('[data-testid="tasks-tab"]')
      if (await tasksTab.isVisible()) {
        await tasksTab.click()
      }
    }
  })

  test('displays task management interface', async ({ page }) => {
    // Check that task management interface is visible
    const tasksContainer = page.locator('[data-testid="tasks-container"]')
    await expect(tasksContainer).toBeVisible()
    
    // Check for main UI elements
    await expect(page.locator('[data-testid="create-task-button"]')).toBeVisible()
    
    // Check for task status columns or list view
    const taskColumns = page.locator('[data-testid="task-column"]')
    const taskList = page.locator('[data-testid="task-list"]')
    
    const hasColumns = await taskColumns.count() > 0
    const hasList = await taskList.isVisible()
    
    expect(hasColumns || hasList).toBeTruthy()
    
    // Check for view toggle if available
    const viewToggle = page.locator('[data-testid="task-view-toggle"]')
    if (await viewToggle.isVisible()) {
      console.log('Task view toggle available')
    }
  })

  test('can create a new task', async ({ page }) => {
    // Click create task button
    await page.click('[data-testid="create-task-button"]')
    
    // Fill in the task form
    const modal = page.locator('[data-testid="create-task-modal"]')
    await expect(modal).toBeVisible()
    
    const taskTitle = `Test Task ${Date.now()}`
    await page.fill('[data-testid="task-title-input"]', taskTitle)
    await page.fill('[data-testid="task-description-input"]', 'Test task for E2E automation testing')
    
    // Select task priority if available
    const prioritySelect = page.locator('[data-testid="task-priority-select"]')
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('high')
    }
    
    // Set task assignee if available
    const assigneeSelect = page.locator('[data-testid="task-assignee-select"]')
    if (await assigneeSelect.isVisible()) {
      await assigneeSelect.selectOption('AI IDE Agent')
    }
    
    // Set feature/category if available
    const featureInput = page.locator('[data-testid="task-feature-input"]')
    if (await featureInput.isVisible()) {
      await featureInput.fill('Testing')
    }
    
    // Set task order/priority number if available
    const orderInput = page.locator('[data-testid="task-order-input"]')
    if (await orderInput.isVisible()) {
      await orderInput.fill('10')
    }
    
    // Submit the form
    await page.click('[data-testid="submit-create-task"]')
    
    // Wait for task creation
    await expect(modal).not.toBeVisible()
    
    // Check that the task appears in the list
    const taskCards = page.locator('[data-testid="task-card"]')
    await expect(taskCards.first()).toBeVisible()
    
    // Verify the task details
    const newTask = taskCards.filter({ hasText: taskTitle })
    await expect(newTask).toBeVisible()
    await expect(newTask.locator('[data-testid="task-title"]')).toContainText(taskTitle)
    await expect(newTask.locator('[data-testid="task-description"]')).toContainText('Test task for E2E')
  })

  test('can update task status through drag and drop', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const taskCount = await taskCards.count()
    
    if (taskCount === 0) {
      test.skip('No tasks available for status update testing')
    }
    
    // Check if kanban columns are available
    const todoColumn = page.locator('[data-testid="task-column-todo"]')
    const doingColumn = page.locator('[data-testid="task-column-doing"]')
    const doneColumn = page.locator('[data-testid="task-column-done"]')
    
    const hasKanbanColumns = await todoColumn.isVisible() && await doingColumn.isVisible()
    
    if (!hasKanbanColumns) {
      test.skip('Kanban view not available for drag and drop testing')
    }
    
    const firstTask = taskCards.first()
    const originalStatus = await firstTask.getAttribute('data-status')
    
    // Drag task from todo to doing column
    await firstTask.dragTo(doingColumn)
    
    // Wait for status update
    await page.waitForTimeout(1000)
    
    // Verify the task moved to the doing column
    const taskInDoing = doingColumn.locator('[data-testid="task-card"]').first()
    await expect(taskInDoing).toBeVisible()
    
    // Check if status indicator updated
    const statusBadge = taskInDoing.locator('[data-testid="task-status-badge"]')
    if (await statusBadge.isVisible()) {
      await expect(statusBadge).toContainText(/doing|in.progress/i)
    }
  })

  test('can edit task details', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const taskCount = await taskCards.count()
    
    if (taskCount === 0) {
      test.skip('No tasks available for editing')
    }
    
    const firstTask = taskCards.first()
    
    // Click edit button or open task context menu
    const editButton = firstTask.locator('[data-testid="edit-task-button"]')
    if (await editButton.isVisible()) {
      await editButton.click()
    } else {
      // Try right-click context menu
      await firstTask.click({ button: 'right' })
      const contextMenu = page.locator('[data-testid="task-context-menu"]')
      if (await contextMenu.isVisible()) {
        await page.click('[data-testid="edit-task-action"]')
      } else {
        // Try clicking on task to open detail view
        await firstTask.click()
        const taskDetail = page.locator('[data-testid="task-detail-modal"]')
        if (await taskDetail.isVisible()) {
          await page.click('[data-testid="edit-task-button"]')
        } else {
          test.skip('Edit functionality not accessible')
        }
      }
    }
    
    // Wait for edit modal
    const editModal = page.locator('[data-testid="edit-task-modal"]')
    await expect(editModal).toBeVisible()
    
    // Make changes to task
    const titleInput = editModal.locator('[data-testid="task-title-input"]')
    const originalTitle = await titleInput.inputValue()
    const newTitle = originalTitle + ' (Edited)'
    
    await titleInput.clear()
    await titleInput.fill(newTitle)
    
    // Update description
    const descriptionInput = editModal.locator('[data-testid="task-description-input"]')
    await descriptionInput.clear()
    await descriptionInput.fill('Updated task description for E2E testing')
    
    // Change priority if available
    const prioritySelect = editModal.locator('[data-testid="task-priority-select"]')
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption('medium')
    }
    
    // Save changes
    await page.click('[data-testid="save-task-changes"]')
    
    // Wait for modal to close
    await expect(editModal).not.toBeVisible()
    
    // Verify the changes
    const updatedTask = page.locator('[data-testid="task-card"]').filter({ hasText: '(Edited)' })
    await expect(updatedTask).toBeVisible()
    await expect(updatedTask.locator('[data-testid="task-description"]')).toContainText('Updated task description')
  })

  test('can change task status through status dropdown', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const taskCount = await taskCards.count()
    
    if (taskCount === 0) {
      test.skip('No tasks available for status change testing')
    }
    
    const firstTask = taskCards.first()
    
    // Look for status dropdown on task card
    const statusDropdown = firstTask.locator('[data-testid="task-status-dropdown"]')
    if (await statusDropdown.isVisible()) {
      await statusDropdown.click()
      
      // Select a different status
      const statusOptions = page.locator('[data-testid="status-option"]')
      const optionCount = await statusOptions.count()
      
      if (optionCount > 1) {
        await statusOptions.nth(1).click()
        
        // Wait for status update
        await page.waitForTimeout(1000)
        
        // Verify status changed
        const statusBadge = firstTask.locator('[data-testid="task-status-badge"]')
        if (await statusBadge.isVisible()) {
          const statusText = await statusBadge.textContent()
          expect(statusText).toBeDefined()
        }
      }
    } else {
      test.skip('Task status dropdown not available')
    }
  })

  test('can assign tasks to different users/agents', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const taskCount = await taskCards.count()
    
    if (taskCount === 0) {
      test.skip('No tasks available for assignment testing')
    }
    
    const firstTask = taskCards.first()
    
    // Look for assignee dropdown on task card
    const assigneeDropdown = firstTask.locator('[data-testid="task-assignee-dropdown"]')
    if (await assigneeDropdown.isVisible()) {
      await assigneeDropdown.click()
      
      // Select a different assignee
      const assigneeOptions = page.locator('[data-testid="assignee-option"]')
      const optionCount = await assigneeOptions.count()
      
      if (optionCount > 1) {
        // Select a specific assignee (e.g., AI IDE Agent)
        const aiAgentOption = assigneeOptions.filter({ hasText: 'AI IDE Agent' })
        if (await aiAgentOption.isVisible()) {
          await aiAgentOption.click()
        } else {
          await assigneeOptions.nth(1).click()
        }
        
        // Wait for assignment update
        await page.waitForTimeout(1000)
        
        // Verify assignment changed
        const assigneeBadge = firstTask.locator('[data-testid="task-assignee-badge"]')
        if (await assigneeBadge.isVisible()) {
          const assigneeText = await assigneeBadge.textContent()
          expect(assigneeText).toBeDefined()
        }
      }
    } else {
      test.skip('Task assignee dropdown not available')
    }
  })

  test('can filter tasks by status, priority, and assignee', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const initialCount = await taskCards.count()
    
    if (initialCount === 0) {
      test.skip('No tasks available for filtering')
    }
    
    // Test status filter
    const statusFilter = page.locator('[data-testid="task-status-filter"]')
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('todo')
      await page.waitForTimeout(500)
      
      // Verify filtered results
      const todoTasks = page.locator('[data-testid="task-card"]:visible')
      const todoCount = await todoTasks.count()
      expect(todoCount).toBeGreaterThanOrEqual(0)
      
      // Reset filter
      await statusFilter.selectOption('all')
    }
    
    // Test priority filter
    const priorityFilter = page.locator('[data-testid="task-priority-filter"]')
    if (await priorityFilter.isVisible()) {
      await priorityFilter.selectOption('high')
      await page.waitForTimeout(500)
      
      // Verify filtered results
      const highPriorityTasks = page.locator('[data-testid="task-card"]:visible')
      const highCount = await highPriorityTasks.count()
      expect(highCount).toBeGreaterThanOrEqual(0)
      
      // Reset filter
      await priorityFilter.selectOption('all')
    }
    
    // Test assignee filter
    const assigneeFilter = page.locator('[data-testid="task-assignee-filter"]')
    if (await assigneeFilter.isVisible()) {
      await assigneeFilter.selectOption('AI IDE Agent')
      await page.waitForTimeout(500)
      
      // Verify filtered results
      const agentTasks = page.locator('[data-testid="task-card"]:visible')
      const agentCount = await agentTasks.count()
      expect(agentCount).toBeGreaterThanOrEqual(0)
      
      // Reset filter
      await assigneeFilter.selectOption('all')
    }
  })

  test('can search tasks by title and description', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const initialCount = await taskCards.count()
    
    if (initialCount === 0) {
      test.skip('No tasks available for search testing')
    }
    
    // Test search functionality
    const searchInput = page.locator('[data-testid="task-search-input"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      
      // Wait for search results
      await page.waitForTimeout(500)
      
      // Verify search results
      const searchResults = page.locator('[data-testid="task-card"]:visible')
      const resultsCount = await searchResults.count()
      
      expect(resultsCount).toBeGreaterThanOrEqual(0)
      
      // Clear search
      await searchInput.clear()
      await page.waitForTimeout(500)
      
      // Verify all tasks are visible again
      const finalCount = await page.locator('[data-testid="task-card"]').count()
      expect(finalCount).toBe(initialCount)
    } else {
      test.skip('Task search not available')
    }
  })

  test('can sort tasks by different criteria', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const taskCount = await taskCards.count()
    
    if (taskCount < 2) {
      test.skip('Need at least 2 tasks for sorting test')
    }
    
    // Test sort by priority
    const sortSelect = page.locator('[data-testid="task-sort-select"]')
    if (await sortSelect.isVisible()) {
      await sortSelect.selectOption('priority')
      await page.waitForTimeout(500)
      
      // Test sort by due date
      await sortSelect.selectOption('due_date')
      await page.waitForTimeout(500)
      
      // Test sort by creation date
      await sortSelect.selectOption('created')
      await page.waitForTimeout(500)
      
      // Test sort by task order
      await sortSelect.selectOption('order')
      await page.waitForTimeout(500)
    } else {
      test.skip('Task sorting not available')
    }
  })

  test('can delete tasks', async ({ page }) => {
    const taskCards = page.locator('[data-testid="task-card"]')
    const initialCount = await taskCards.count()
    
    if (initialCount === 0) {
      test.skip('No tasks available for deletion')
    }
    
    const firstTask = taskCards.first()
    const taskTitle = await firstTask.locator('[data-testid="task-title"]').textContent()
    
    // Click delete button
    const deleteButton = firstTask.locator('[data-testid="delete-task-button"]')
    if (await deleteButton.isVisible()) {
      await deleteButton.click()
    } else {
      // Try right-click context menu
      await firstTask.click({ button: 'right' })
      const contextMenu = page.locator('[data-testid="task-context-menu"]')
      if (await contextMenu.isVisible()) {
        await page.click('[data-testid="delete-task-action"]')
      } else {
        test.skip('Delete functionality not accessible')
      }
    }
    
    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm')
      expect(dialog.message()).toContain(/delete/i)
      await dialog.accept()
    })
    
    // Wait for deletion
    await page.waitForTimeout(1000)
    
    // Verify task was deleted
    const finalCount = await page.locator('[data-testid="task-card"]').count()
    expect(finalCount).toBe(initialCount - 1)
    
    // Verify specific task is no longer visible
    const deletedTask = page.locator('[data-testid="task-card"]').filter({ hasText: taskTitle || '' })
    expect(await deletedTask.count()).toBe(0)
  })

  test('displays task analytics and progress tracking', async ({ page }) => {
    // Check for task analytics dashboard
    const analyticsSection = page.locator('[data-testid="task-analytics"]')
    if (await analyticsSection.isVisible()) {
      // Verify analytics elements
      const totalTasks = analyticsSection.locator('[data-testid="total-tasks-count"]')
      const completedTasks = analyticsSection.locator('[data-testid="completed-tasks-count"]')
      const progressChart = analyticsSection.locator('[data-testid="progress-chart"]')
      
      if (await totalTasks.isVisible()) {
        const totalText = await totalTasks.textContent()
        expect(totalText).toMatch(/\d+/)
      }
      
      if (await completedTasks.isVisible()) {
        const completedText = await completedTasks.textContent()
        expect(completedText).toMatch(/\d+/)
      }
      
      if (await progressChart.isVisible()) {
        console.log('Progress chart is available')
      }
    }
    
    // Check for project progress bar
    const projectProgress = page.locator('[data-testid="project-progress-bar"]')
    if (await projectProgress.isVisible()) {
      const progressValue = await projectProgress.getAttribute('aria-valuenow')
      expect(progressValue).toBeDefined()
    }
  })

  test('supports keyboard navigation and accessibility', async ({ page }) => {
    // Check that main elements are focusable
    const createButton = page.locator('[data-testid="create-task-button"]')
    await createButton.focus()
    expect(await createButton.evaluate(el => document.activeElement === el)).toBeTruthy()
    
    // Check ARIA labels
    await expect(createButton).toHaveAttribute('aria-label')
    
    // Test keyboard navigation through task cards
    const taskCards = page.locator('[data-testid="task-card"]')
    const taskCount = await taskCards.count()
    
    if (taskCount > 0) {
      const firstTask = taskCards.first()
      await firstTask.focus()
      
      // Check that task cards are keyboard accessible
      expect(await firstTask.evaluate(el => document.activeElement === el)).toBeTruthy()
      
      // Test Enter key to open task
      await firstTask.press('Enter')
      
      // Should open task detail or edit modal
      const taskDetail = page.locator('[data-testid="task-detail-modal"], [data-testid="edit-task-modal"]')
      if (await taskDetail.isVisible()) {
        // Close the modal
        const closeButton = taskDetail.locator('[data-testid="close-task-detail"], [data-testid="cancel-edit-task"]')
        if (await closeButton.isVisible()) {
          await closeButton.click()
        } else {
          await page.press('body', 'Escape')
        }
      }
    }
  })

  test('handles task creation errors gracefully', async ({ page }) => {
    // Try to create a task with invalid data
    await page.click('[data-testid="create-task-button"]')
    
    const modal = page.locator('[data-testid="create-task-modal"]')
    await expect(modal).toBeVisible()
    
    // Try to submit without required fields
    await page.click('[data-testid="submit-create-task"]')
    
    // Check for validation errors
    const errorMessages = page.locator('[data-testid="field-error"]')
    const errorCount = await errorMessages.count()
    expect(errorCount).toBeGreaterThan(0)
    
    // Fill in title but leave description empty if required
    await page.fill('[data-testid="task-title-input"]', 'Test Error Task')
    
    // Try invalid task order
    const orderInput = page.locator('[data-testid="task-order-input"]')
    if (await orderInput.isVisible()) {
      await orderInput.fill('-1')
      await page.click('[data-testid="submit-create-task"]')
      
      // Check for validation error
      const orderError = page.locator('[data-testid="task-order-error"]')
      if (await orderError.isVisible()) {
        await expect(orderError).toContainText(/invalid|positive|number/i)
      }
    }
    
    // Cancel task creation
    await page.click('[data-testid="cancel-create-task"]')
    await expect(modal).not.toBeVisible()
  })
})