# Archon V2 Beta - E2E Testing Suite

Comprehensive end-to-end testing suite using Playwright for cross-browser testing, performance monitoring, and accessibility validation.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Backend server running on port 8181
- Frontend dev server running on port 5173

### Installation
```bash
# Install dependencies (including Playwright)
npm install

# Install Playwright browsers
npx playwright install
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug -- --grep "knowledge base"

# View test reports
npm run test:e2e:report

# Run specific test files
npm run test:e2e projects.spec.ts                 # Project management tests
npm run test:e2e tasks.spec.ts                    # Task management tests  
npm run test:e2e mcp-integration.spec.ts          # MCP integration tests
npm run test:e2e visual-regression.spec.ts        # Visual regression tests

# Run tests for specific features
npm run test:e2e:debug -- --grep "project creation"
npm run test:e2e:debug -- --grep "task management"
npm run test:e2e:debug -- --grep "MCP integration"
npm run test:e2e:debug -- --grep "visual consistency"
```

## 📁 Test Structure

### Test Files
- `knowledge-base.spec.ts` - Knowledge management workflows
- `navigation.spec.ts` - Navigation and routing functionality  
- `settings.spec.ts` - Configuration and feature toggles
- `performance.spec.ts` - Performance metrics and Core Web Vitals
- `projects.spec.ts` - **NEW** Project creation, editing, and organization workflows
- `tasks.spec.ts` - **NEW** Task management, status changes, and project integration
- `mcp-integration.spec.ts` - **NEW** MCP server connectivity and tool execution
- `visual-regression.spec.ts` - **NEW** Visual consistency and UI regression testing

### Setup Files
- `auth.setup.ts` - Authentication state management
- `global-setup.ts` - Test environment preparation
- `global-teardown.ts` - Cleanup and reporting

## 🎯 Test Coverage

### User Workflows
- ✅ Knowledge Base Management
  - Add/edit/delete knowledge items
  - URL crawling and progress tracking
  - Search and filtering
  - Status updates and error handling

- ✅ Navigation & Routing
  - Multi-page navigation
  - Browser back/forward
  - Direct URL access
  - Mobile responsiveness

- ✅ Settings Management
  - API key configuration
  - Feature flag toggles
  - RAG and extraction settings
  - Settings persistence

- ✅ **NEW** Project Management
  - Project creation and setup
  - Project editing and organization
  - Project archiving and restoration
  - Project filtering and search
  - Project statistics and metrics

- ✅ **NEW** Task Management
  - Task creation and assignment
  - Task status updates (drag & drop)
  - Task filtering and search
  - Task priority and organization
  - Task deletion and error handling

- ✅ **NEW** MCP Integration
  - MCP server connectivity and health
  - RAG query execution through MCP
  - Code example search via MCP
  - Project/task management via MCP
  - MCP operation monitoring and logs

- ✅ **NEW** Visual Regression Testing
  - Cross-browser visual consistency
  - Responsive design validation
  - Modal and component screenshots
  - Dark mode visual testing
  - Error and loading state visuals

### Performance Testing
- ✅ Page Load Performance (<3s target)
- ✅ Core Web Vitals (LCP, FID, CLS)
- ✅ Bundle Size Monitoring (500KB JS, 2MB total)
- ✅ Memory Usage Tracking
- ✅ API Response Times (<1s target)
- ✅ Accessibility Compliance (WCAG 2.1 AA)

### Cross-Browser Support
- ✅ Desktop: Chrome, Firefox, Safari
- ✅ Mobile: Chrome Mobile, Safari Mobile
- ✅ Tablet: iPad Pro

## 📊 Performance Budgets

### Load Performance
- **Page Load Time**: <3 seconds
- **First Contentful Paint**: <1.8 seconds
- **Largest Contentful Paint**: <2.5 seconds
- **First Input Delay**: <100ms
- **Cumulative Layout Shift**: <0.1

### Bundle Size
- **JavaScript**: <500KB initial
- **CSS**: <100KB
- **Total Bundle**: <2MB
- **Individual Chunks**: <500KB warning threshold

### Memory Usage
- **Initial Load**: <50MB
- **Memory Growth**: <20MB after interactions
- **API Response Time**: <1 second

## 🔧 Configuration

### Playwright Config (`playwright.config.ts`)
- **Parallel Execution**: Enabled for faster test runs
- **Retry Strategy**: 2 retries on CI, 0 locally
- **Video Recording**: On failure only
- **Screenshots**: On failure only
- **Trace Collection**: On first retry

### Browser Projects
```typescript
// Desktop browsers
'chromium', 'firefox', 'webkit'

// Mobile devices  
'Mobile Chrome', 'Mobile Safari'

// Tablet
'iPad Pro'
```

### Web Servers
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:8181 (FastAPI server)

## 📈 Reports and Artifacts

### Generated Reports
- **HTML Report**: `e2e-reports/html/index.html`
- **JSON Results**: `e2e-reports/results.json`
- **JUnit XML**: `e2e-reports/junit.xml`
- **Performance Summary**: `e2e-reports/performance-summary.json`

### Test Artifacts
- **Videos**: `e2e-reports/videos/` (on failure)
- **Screenshots**: `e2e-reports/artifacts/` (on failure)
- **Traces**: `e2e-reports/artifacts/` (on retry)

## 🧪 Writing Tests

### Test Pattern
```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/relevant-page')
  })

  test('should do something', async ({ page }) => {
    // Arrange
    await page.click('[data-testid="action-button"]')
    
    // Act & Assert
    await expect(page.locator('[data-testid="result"]')).toBeVisible()
  })
})
```

### Best Practices
- Use `data-testid` attributes for reliable element selection
- Wait for network idle before assertions
- Test both success and error scenarios
- Include accessibility checks
- Monitor performance metrics

### Element Selection
```typescript
// ✅ Good - stable selectors
page.locator('[data-testid="knowledge-item-card"]')
page.locator('[data-testid="nav-settings"]')

// ❌ Avoid - fragile selectors
page.locator('.css-class-name')
page.locator('div > span:nth-child(3)')
```

## 🚨 Troubleshooting

### Common Issues

**Backend Not Ready**
```bash
# Check backend health
curl http://localhost:8181/health

# Start backend manually
cd ../python && uv run python -m src.server.main
```

**Frontend Not Loading**
```bash
# Check frontend dev server
curl http://localhost:5173

# Start frontend manually
npm run dev
```

**Browser Installation**
```bash
# Reinstall browsers
npx playwright install --force
```

**Port Conflicts**
```bash
# Kill processes on required ports
lsof -ti:5173 | xargs kill -9
lsof -ti:8181 | xargs kill -9
```

### Debug Mode
```bash
# Run with debug info
DEBUG=pw:* npm run test:e2e

# Run specific test with debug
npx playwright test knowledge-base.spec.ts --debug
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install --with-deps

- name: Start backend
  run: |
    cd python && uv run python -m src.server.main &
    
- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: e2e-reports/
```

### Performance Monitoring
- Integrate with performance monitoring tools
- Set up alerts for performance regression
- Track Core Web Vitals over time
- Monitor bundle size growth

## 📋 Test Data Management

### Test Data Setup
- Automatic test data seeding in `global-setup.ts`
- Test knowledge items and projects created
- Clean test environment on teardown

### Test Isolation
- Each test runs independently
- Test data cleaned between runs
- No shared state between tests

## 🎯 Performance Targets

Based on our beta performance enhancement goals:

| Metric | Target | Current |
|--------|--------|---------|
| Page Load | <3s | Measured |
| Bundle Size | <500KB JS | Monitored |
| FCP | <1.8s | Tracked |
| LCP | <2.5s | Tracked |
| FID | <100ms | Tracked |
| CLS | <0.1 | Tracked |
| Memory | <50MB initial | Monitored |

## 🔐 Security Testing

### Included Security Tests
- XSS prevention validation
- CSRF protection checks
- Input sanitization testing
- Authentication flow security

### Security Best Practices
- No sensitive data in test files
- Secure test user credentials
- Environment variable usage
- Safe test data cleanup

---

## 🚀 Next Steps

1. **Expand Test Coverage**: Add more edge cases and user scenarios
2. **Visual Regression**: Implement screenshot comparison testing
3. **Load Testing**: Add stress testing for high concurrent users
4. **Mobile Testing**: Enhance mobile-specific test scenarios
5. **Integration**: Connect with monitoring and alerting systems