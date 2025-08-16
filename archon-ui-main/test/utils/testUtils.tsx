import React, { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import { KnowledgeItem, Project, Task } from '@/types'

// Mock providers that components might need
interface TestProvidersProps {
  children: ReactNode
}

const TestProviders: React.FC<TestProvidersProps> = ({ children }) => {
  return (
    <div data-testid="test-providers">
      {children}
    </div>
  )
}

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: TestProviders, ...options })
}

// Mock data factories
export const createMockKnowledgeItem = (overrides: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id: `knowledge-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Mock Knowledge Item',
  url: 'https://example.com',
  source_type: 'url',
  status: 'processed',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  document_count: 5,
  metadata: {
    description: 'Mock description',
    tags: ['test', 'mock']
  },
  ...overrides
})

export const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: `project-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Mock Project',
  description: 'A mock project for testing',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  metadata: {
    github_repo: 'https://github.com/user/repo',
    tech_stack: ['React', 'TypeScript'],
    tags: ['frontend', 'web']
  },
  task_count: 3,
  document_count: 2,
  progress: 60,
  ...overrides
})

export const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Mock Task',
  description: 'A mock task for testing',
  status: 'todo',
  priority: 'medium',
  assignee: 'User',
  task_order: 1,
  feature: 'testing',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  project_id: 'project-1',
  ...overrides
})

// Mock API responses
export const createMockApiResponse = <T>(data: T, metadata: any = {}) => ({
  ...data,
  total: Array.isArray(data) ? data.length : 1,
  page: 1,
  per_page: 20,
  ...metadata
})

// Mock fetch response builder
export const createMockFetchResponse = (data: any, options: { ok?: boolean; status?: number } = {}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
  ...options
})

// Mock WebSocket
export const createMockWebSocket = () => {
  const mockSocket = {
    onopen: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    readyState: WebSocket.CONNECTING,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    
    // Helper methods for testing
    triggerOpen: () => {
      mockSocket.readyState = WebSocket.OPEN
      if (mockSocket.onopen) {
        mockSocket.onopen(new Event('open'))
      }
    },
    
    triggerClose: (code = 1000, reason = '') => {
      mockSocket.readyState = WebSocket.CLOSED
      if (mockSocket.onclose) {
        mockSocket.onclose(new CloseEvent('close', { code, reason }))
      }
    },
    
    triggerMessage: (data: any) => {
      if (mockSocket.onmessage) {
        mockSocket.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
      }
    },
    
    triggerError: () => {
      if (mockSocket.onerror) {
        mockSocket.onerror(new Event('error'))
      }
    }
  }
  
  return mockSocket
}

// Local storage mock
export const createMockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length
    },
    
    // Test helpers
    getStore: () => ({ ...store }),
    setStore: (newStore: Record<string, string>) => {
      Object.keys(store).forEach(key => delete store[key])
      Object.assign(store, newStore)
    }
  }
}

// Mock intersection observer
export const createMockIntersectionObserver = () => {
  const mockObserver = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
    
    // Test helpers
    triggerIntersection: (entries: Partial<IntersectionObserverEntry>[]) => {
      // Simulate intersection callback
      const callback = mockObserver._callback
      if (callback) {
        const fullEntries = entries.map(entry => ({
          isIntersecting: false,
          intersectionRatio: 0,
          intersectionRect: new DOMRect(),
          boundingClientRect: new DOMRect(),
          rootBounds: null,
          target: document.createElement('div'),
          time: Date.now(),
          ...entry
        }))
        callback(fullEntries, mockObserver)
      }
    },
    
    _callback: null as IntersectionObserverCallback | null
  }
  
  const MockIntersectionObserver = vi.fn((callback: IntersectionObserverCallback) => {
    mockObserver._callback = callback
    return mockObserver
  })
  
  return { MockIntersectionObserver, mockObserver }
}

// Async utility functions
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0))

export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
) => {
  const { timeout = 5000, interval = 50 } = options
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}

// Form testing utilities
export const fillForm = async (
  fields: Record<string, string>,
  options: { submit?: boolean } = {}
) => {
  const { fireEvent, screen } = await import('@testing-library/react')
  
  for (const [fieldName, value] of Object.entries(fields)) {
    const field = screen.getByLabelText(new RegExp(fieldName, 'i')) ||
                  screen.getByPlaceholderText(new RegExp(fieldName, 'i')) ||
                  screen.getByDisplayValue(new RegExp(fieldName, 'i'))
    
    fireEvent.change(field, { target: { value } })
  }
  
  if (options.submit) {
    const submitButton = screen.getByRole('button', { name: /submit|save|create/i })
    fireEvent.click(submitButton)
  }
}

// Error boundary wrapper for testing error scenarios
export const ErrorBoundary: React.FC<{ children: ReactNode; onError?: (error: Error) => void }> = ({ 
  children, 
  onError 
}) => {
  const [hasError, setHasError] = React.useState(false)
  
  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      setHasError(true)
      onError?.(error.error)
    }
    
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [onError])
  
  if (hasError) {
    return <div data-testid="error-boundary">Something went wrong</div>
  }
  
  return <>{children}</>
}

// Mock date utilities
export const mockDate = (date: string | Date) => {
  const mockDateObj = new Date(date)
  vi.useFakeTimers()
  vi.setSystemTime(mockDateObj)
  return () => vi.useRealTimers()
}

// Performance monitoring mock
export const createMockPerformanceObserver = () => {
  const mockObserver = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
    
    // Test helpers
    triggerEntries: (entries: Partial<PerformanceEntry>[]) => {
      const callback = mockObserver._callback
      if (callback) {
        const list = {
          getEntries: () => entries as PerformanceEntry[],
          getEntriesByName: (name: string) => entries.filter(e => e.name === name) as PerformanceEntry[],
          getEntriesByType: (type: string) => entries.filter(e => e.entryType === type) as PerformanceEntry[]
        }
        callback(list, mockObserver)
      }
    },
    
    _callback: null as PerformanceObserverCallback | null
  }
  
  const MockPerformanceObserver = vi.fn((callback: PerformanceObserverCallback) => {
    mockObserver._callback = callback
    return mockObserver
  })
  
  return { MockPerformanceObserver, mockObserver }
}

// Export everything including the custom render
export * from '@testing-library/react'
export { customRender as render }