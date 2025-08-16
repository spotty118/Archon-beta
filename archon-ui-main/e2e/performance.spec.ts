/**
 * E2E Performance Tests for Archon V2 Beta
 * Tests performance metrics, Core Web Vitals, and accessibility
 */

import { test, expect } from '@playwright/test'

test.describe('Performance Testing', () => {
  test('measures page load performance', async ({ page }) => {
    // Start performance measurement
    const startTime = Date.now()
    
    await page.goto('/', { waitUntil: 'networkidle' })
    
    const loadTime = Date.now() - startTime
    
    // Performance assertions
    expect(loadTime).toBeLessThan(3000) // 3 second budget
    
    console.log(`Page load time: ${loadTime}ms`)
    
    // Check for performance marks if available
    const performanceMetrics = await page.evaluate(() => {
      return {
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime,
      }
    })
    
    console.log('Performance metrics:', performanceMetrics)
    
    // Core Web Vitals targets
    if (performanceMetrics.firstContentfulPaint) {
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1800) // 1.8s FCP
    }
  })

  test('measures Core Web Vitals', async ({ page }) => {
    await page.goto('/')
    
    // Wait for the page to be fully interactive
    await page.waitForLoadState('networkidle')
    
    // Measure Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {}
        
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          vitals.lcp = lastEntry.startTime
        }).observe({ entryTypes: ['largest-contentful-paint'] })
        
        // First Input Delay (FID) - simulate user interaction
        setTimeout(() => {
          const button = document.querySelector('button') || document.body
          button.click()
          
          new PerformanceObserver((list) => {
            const firstInput = list.getEntries()[0]
            if (firstInput) {
              vitals.fid = firstInput.processingStart - firstInput.startTime
            }
          }).observe({ entryTypes: ['first-input'] })
        }, 100)
        
        // Cumulative Layout Shift (CLS)
        let clsValue = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
          vitals.cls = clsValue
        }).observe({ entryTypes: ['layout-shift'] })
        
        // Resolve after collecting metrics
        setTimeout(() => resolve(vitals), 3000)
      })
    })
    
    console.log('Core Web Vitals:', webVitals)
    
    // Assert Core Web Vitals thresholds
    if ((webVitals as any).lcp) {
      expect((webVitals as any).lcp).toBeLessThan(2500) // 2.5s LCP target
    }
    
    if ((webVitals as any).fid) {
      expect((webVitals as any).fid).toBeLessThan(100) // 100ms FID target
    }
    
    if ((webVitals as any).cls !== undefined) {
      expect((webVitals as any).cls).toBeLessThan(0.1) // 0.1 CLS target
    }
  })

  test('checks bundle size performance', async ({ page }) => {
    // Monitor network requests
    const requests: any[] = []
    
    page.on('request', request => {
      if (request.resourceType() === 'script' || request.resourceType() === 'stylesheet') {
        requests.push({
          url: request.url(),
          type: request.resourceType()
        })
      }
    })
    
    page.on('response', response => {
      if (response.request().resourceType() === 'script' || response.request().resourceType() === 'stylesheet') {
        const request = requests.find(r => r.url === response.url())
        if (request) {
          response.body().then(body => {
            request.size = body.length
          }).catch(() => {
            // Ignore errors for cross-origin resources
          })
        }
      }
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Calculate total bundle sizes
    const scriptSize = requests
      .filter(r => r.type === 'script' && r.size)
      .reduce((total, r) => total + r.size, 0)
    
    const styleSize = requests
      .filter(r => r.type === 'stylesheet' && r.size)
      .reduce((total, r) => total + r.size, 0)
    
    console.log(`JavaScript bundle size: ${(scriptSize / 1024).toFixed(2)} KB`)
    console.log(`CSS bundle size: ${(styleSize / 1024).toFixed(2)} KB`)
    console.log(`Total bundle size: ${((scriptSize + styleSize) / 1024).toFixed(2)} KB`)
    
    // Performance budgets (based on our configuration)
    expect(scriptSize).toBeLessThan(500 * 1024) // 500KB JS budget
    expect(styleSize).toBeLessThan(100 * 1024)  // 100KB CSS budget
    expect(scriptSize + styleSize).toBeLessThan(2 * 1024 * 1024) // 2MB total budget
  })

  test('measures navigation performance', async ({ page }) => {
    await page.goto('/')
    
    // Measure navigation to different pages
    const navigationTimes: Record<string, number> = {}
    
    // Test navigation to Settings
    const settingsStartTime = Date.now()
    await page.click('[data-testid="nav-settings"]')
    await page.waitForSelector('[data-testid="settings-page"]')
    navigationTimes.settings = Date.now() - settingsStartTime
    
    // Test navigation back to Knowledge Base
    const knowledgeStartTime = Date.now()
    await page.click('[data-testid="nav-knowledge-base"]')
    await page.waitForSelector('[data-testid="knowledge-base"]')
    navigationTimes.knowledgeBase = Date.now() - knowledgeStartTime
    
    console.log('Navigation times:', navigationTimes)
    
    // Navigation should be fast due to client-side routing
    Object.values(navigationTimes).forEach(time => {
      expect(time).toBeLessThan(500) // 500ms navigation budget
    })
  })

  test('checks memory usage', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null
    })
    
    if (initialMemory) {
      console.log('Initial memory usage:', {
        used: `${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(initialMemory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(initialMemory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      })
      
      // Memory usage should be reasonable for initial load
      expect(initialMemory.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024) // 50MB budget
    }
    
    // Simulate some interactions to check for memory leaks
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="nav-settings"]')
      await page.waitForSelector('[data-testid="settings-page"]')
      await page.click('[data-testid="nav-knowledge-base"]')
      await page.waitForSelector('[data-testid="knowledge-base"]')
    }
    
    // Check memory after interactions
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize
      } : null
    })
    
    if (initialMemory && finalMemory) {
      const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
      console.log(`Memory growth after interactions: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`)
      
      // Memory growth should be minimal (potential memory leak check)
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024) // 20MB growth limit
    }
  })

  test('checks accessibility performance', async ({ page }) => {
    await page.goto('/')
    
    // Inject axe-core for accessibility testing
    await page.addScriptTag({
      url: 'https://unpkg.com/axe-core@4.7.0/axe.min.js'
    })
    
    // Run accessibility scan
    const accessibilityResults = await page.evaluate(() => {
      return new Promise((resolve) => {
        (window as any).axe.run((err: any, results: any) => {
          if (err) throw err
          resolve(results)
        })
      })
    })
    
    const results = accessibilityResults as any
    
    console.log(`Accessibility scan results:`)
    console.log(`- Violations: ${results.violations.length}`)
    console.log(`- Passes: ${results.passes.length}`)
    console.log(`- Incomplete: ${results.incomplete.length}`)
    
    // Log violations for debugging
    if (results.violations.length > 0) {
      console.log('Accessibility violations:')
      results.violations.forEach((violation: any, index: number) => {
        console.log(`${index + 1}. ${violation.id}: ${violation.description}`)
        console.log(`   Impact: ${violation.impact}`)
        console.log(`   Nodes: ${violation.nodes.length}`)
      })
    }
    
    // Assert accessibility standards
    expect(results.violations.length).toBe(0) // No accessibility violations
  })

  test('measures image loading performance', async ({ page }) => {
    const imageRequests: any[] = []
    
    page.on('response', response => {
      if (response.request().resourceType() === 'image') {
        imageRequests.push({
          url: response.url(),
          status: response.status(),
          timing: response.timing()
        })
      }
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    if (imageRequests.length > 0) {
      console.log(`Loaded ${imageRequests.length} images`)
      
      // Check image loading performance
      imageRequests.forEach(img => {
        expect(img.status).toBe(200) // All images should load successfully
        
        if (img.timing) {
          const loadTime = img.timing.responseEnd - img.timing.requestStart
          expect(loadTime).toBeLessThan(2000) // 2 second image load budget
        }
      })
      
      // Check for lazy loading implementation
      const lazyImages = await page.locator('img[loading="lazy"]').count()
      console.log(`Images with lazy loading: ${lazyImages}`)
    }
  })

  test('checks font loading performance', async ({ page }) => {
    const fontRequests: any[] = []
    
    page.on('response', response => {
      if (response.request().resourceType() === 'font') {
        fontRequests.push({
          url: response.url(),
          status: response.status()
        })
      }
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    if (fontRequests.length > 0) {
      console.log(`Loaded ${fontRequests.length} fonts`)
      
      // All fonts should load successfully
      fontRequests.forEach(font => {
        expect(font.status).toBe(200)
      })
      
      // Check for font-display usage
      const fontDisplayUsage = await page.evaluate(() => {
        const stylesheets = Array.from(document.styleSheets)
        let hasFontDisplay = false
        
        stylesheets.forEach(sheet => {
          try {
            const rules = Array.from(sheet.cssRules || [])
            rules.forEach(rule => {
              if (rule.cssText.includes('@font-face') && rule.cssText.includes('font-display')) {
                hasFontDisplay = true
              }
            })
          } catch (e) {
            // Cross-origin stylesheets may not be accessible
          }
        })
        
        return hasFontDisplay
      })
      
      console.log(`Font-display optimization detected: ${fontDisplayUsage}`)
    }
  })

  test('measures API response times', async ({ page }) => {
    const apiRequests: any[] = []
    
    page.on('response', response => {
      const url = response.url()
      if (url.includes('/api/')) {
        apiRequests.push({
          url,
          status: response.status(),
          timing: response.timing()
        })
      }
    })
    
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Navigate to different pages to trigger API calls
    await page.click('[data-testid="nav-settings"]')
    await page.waitForLoadState('networkidle')
    
    if (apiRequests.length > 0) {
      console.log(`Made ${apiRequests.length} API requests`)
      
      apiRequests.forEach(request => {
        console.log(`API: ${request.url.split('/api/')[1]} - ${request.status}`)
        
        if (request.timing) {
          const responseTime = request.timing.responseEnd - request.timing.requestStart
          console.log(`  Response time: ${responseTime}ms`)
          
          // API calls should be fast
          expect(responseTime).toBeLessThan(1000) // 1 second API budget
        }
        
        // All API calls should succeed
        expect(request.status).toBeLessThan(400)
      })
    }
  })
})