/**
 * Global setup for Playwright E2E tests
 * Prepares test environment and seeds test data
 */

import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...')
  
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // Wait for backend to be ready
    console.log('⏳ Waiting for backend to be ready...')
    await page.goto('http://localhost:8181/health', { waitUntil: 'networkidle' })
    const healthResponse = await page.textContent('body')
    
    if (!healthResponse?.includes('"ready":true')) {
      throw new Error('Backend is not ready for testing')
    }
    
    console.log('✅ Backend is ready')
    
    // Wait for frontend to be ready
    console.log('⏳ Waiting for frontend to be ready...')
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
    
    // Check if the app loaded successfully
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 30000 })
    console.log('✅ Frontend is ready')
    
    // Seed test data if needed
    console.log('🌱 Seeding test data...')
    await seedTestData(page)
    
    console.log('✅ Global setup completed')
    
  } catch (error) {
    console.error('❌ Global setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

async function seedTestData(page: any) {
  try {
    // Create test knowledge items
    await page.evaluate(async () => {
      const testKnowledgeItems = [
        {
          id: 'test-knowledge-1',
          title: 'Test Documentation',
          url: 'https://example.com/docs',
          description: 'Test documentation for E2E testing',
          knowledge_type: 'documentation',
          tags: ['test', 'e2e'],
          document_count: 3,
        },
        {
          id: 'test-knowledge-2', 
          title: 'Test API Reference',
          url: 'https://api.example.com/docs',
          description: 'Test API reference for E2E testing',
          knowledge_type: 'api',
          tags: ['api', 'test'],
          document_count: 5,
        }
      ]
      
      // Store in localStorage for tests
      localStorage.setItem('test-knowledge-items', JSON.stringify(testKnowledgeItems))
    })
    
    // Create test project data if projects are enabled
    await page.evaluate(async () => {
      const testProjects = [
        {
          id: 'test-project-1',
          title: 'Test Project Alpha',
          description: 'A test project for E2E testing',
          status: 'active',
          tasks: [
            {
              id: 'test-task-1',
              title: 'Test Task 1',
              description: 'First test task',
              status: 'todo',
              priority: 'high'
            },
            {
              id: 'test-task-2',
              title: 'Test Task 2', 
              description: 'Second test task',
              status: 'in_progress',
              priority: 'medium'
            }
          ]
        }
      ]
      
      localStorage.setItem('test-projects', JSON.stringify(testProjects))
    })
    
    console.log('✅ Test data seeded successfully')
    
  } catch (error) {
    console.warn('⚠️ Failed to seed test data:', error)
    // Don't fail the entire setup for seeding issues
  }
}

export default globalSetup