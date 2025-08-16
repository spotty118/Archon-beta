import React from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

// Mock data generators
export const createMockProject = (overrides = {}) => ({
  id: 'project-1',
  title: 'Test Project',
  description: 'A test project for unit testing',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  metadata: {
    tech_stack: ['React', 'TypeScript'],
    tags: ['frontend', 'test'],
    priority: 'medium'
  },
  task_count: 5,
  document_count: 3,
  progress: 60,
  ...overrides
})

export const createMockTask = (overrides = {}) => ({
  id: 'task-1',
  title: 'Test Task',
  description: 'A test task for unit testing',
  status: 'todo',
  priority: 'medium',
  assignee: 'User',
  task_order: 1,
  feature: 'testing',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  project_id: 'project-1',
  ...overrides
})

export const createMockKnowledgeItem = (overrides = {}) => ({
  id: 'knowledge-1',
  title: 'Test Document',
  source_type: 'upload',
  status: 'processed',
  document_count: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  metadata: {
    description: 'A test document',
    tags: ['test', 'documentation'],
    file_type: 'pdf',
    size: 1024
  },
  ...overrides
})

export const createMockApiResponse = <T>(data: T, overrides = {}) => ({
  success: true,
  data,
  message: 'Success',
  ...overrides
})

export const createMockApiError = (message = 'Test error', code = 400) => ({
  success: false,
  error: message,
  code,
  details: 'Error details for testing'
})

// Test context providers
interface MockProviderProps {
  children: React.ReactNode
  initialSettings?: any
  initialTheme?: 'light' | 'dark'
}

export const MockSettingsProvider: React.FC<MockProviderProps> = ({ 
  children, 
  initialSettings = {},
  initialTheme = 'dark' 
}) => {
  const [settings, setSettings] = React.useState({
    theme: initialTheme,
    notifications: true,
    autoSave: false,
    projectsEnabled: true,
    ...initialSettings
  })

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const contextValue = {
    settings,
    updateSetting,
    isLoading: false,
    saveSettings: vi.fn().mockResolvedValue(true),
    resetSettings: vi.fn()
  }

  return (
    <div data-testid="mock-settings-provider">
      {React.cloneElement(children as React.ReactElement, { settingsContext: contextValue })}
    </div>
  )
}

export const MockThemeProvider: React.FC<MockProviderProps> = ({ 
  children, 
  initialTheme = 'dark' 
}) => {
  const [theme, setTheme] = React.useState(initialTheme)

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const contextValue = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  }

  return (
    <div data-testid="mock-theme-provider" className={`theme-${theme}`}>
      {React.cloneElement(children as React.ReactElement, { themeContext: contextValue })}
    </div>
  )
}

export const MockToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<any[]>([])

  const addToast = (toast: any) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { ...toast, id }])
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const contextValue = {
    toasts,
    addToast,
    removeToast,
    showSuccess: (message: string) => addToast({ type: 'success', message }),
    showError: (message: string) => addToast({ type: 'error', message }),
    showWarning: (message: string) => addToast({ type: 'warning', message }),
    showInfo: (message: string) => addToast({ type: 'info', message })
  }

  return (
    <div data-testid="mock-toast-provider">
      {React.cloneElement(children as React.ReactElement, { toastContext: contextValue })}
      <div data-testid="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} data-testid={`toast-${toast.type}`} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

// Combined provider for comprehensive testing
export const MockAllProviders: React.FC<MockProviderProps> = ({ 
  children, 
  initialSettings,
  initialTheme 
}) => {
  return (
    <MockThemeProvider initialTheme={initialTheme}>
      <MockSettingsProvider initialSettings={initialSettings}>
        <MockToastProvider>
          {children}
        </MockToastProvider>
      </MockSettingsProvider>
    </MockThemeProvider>
  )
}

// Custom render function with providers
export const renderWithProviders = (
  component: React.ReactElement,
  options: {
    initialSettings?: any
    initialTheme?: 'light' | 'dark'
    withToasts?: boolean
  } = {}
) => {
  const { initialSettings, initialTheme, withToasts = true } = options

  if (withToasts) {
    return render(
      <MockAllProviders 
        initialSettings={initialSettings} 
        initialTheme={initialTheme}
      >
        {component}
      </MockAllProviders>
    )
  }

  return render(
    <MockThemeProvider initialTheme={initialTheme}>
      <MockSettingsProvider initialSettings={initialSettings}>
        {component}
      </MockSettingsProvider>
    </MockThemeProvider>
  )
}

// Mock API client
export class MockApiClient {
  private delay: number
  private shouldFail: boolean

  constructor(delay = 100, shouldFail = false) {
    this.delay = delay
    this.shouldFail = shouldFail
  }

  setDelay(delay: number) {
    this.delay = delay
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail
  }

  private async mockRequest<T>(data: T): Promise<T> {
    await new Promise(resolve => setTimeout(resolve, this.delay))
    
    if (this.shouldFail) {
      throw new Error('Mock API request failed')
    }
    
    return data
  }

  async get<T>(url: string, data: T): Promise<T> {
    return this.mockRequest(data)
  }

  async post<T>(url: string, data: T): Promise<T> {
    return this.mockRequest(data)
  }

  async put<T>(url: string, data: T): Promise<T> {
    return this.mockRequest(data)
  }

  async delete<T>(url: string, data: T): Promise<T> {
    return this.mockRequest(data)
  }
}

// Mock WebSocket for socket testing
export class MockWebSocket {
  private listeners: Map<string, Function[]> = new Map()
  private _readyState = WebSocket.CONNECTING

  constructor() {
    // Simulate connection
    setTimeout(() => {
      this._readyState = WebSocket.OPEN
      this.dispatchEvent('open', null)
    }, 100)
  }

  get readyState() {
    return this._readyState
  }

  addEventListener(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(listener)
  }

  removeEventListener(event: string, listener: Function) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  send(data: string) {
    // Simulate echo response
    setTimeout(() => {
      this.dispatchEvent('message', { data: `Echo: ${data}` })
    }, 50)
  }

  close() {
    this._readyState = WebSocket.CLOSED
    this.dispatchEvent('close', null)
  }

  private dispatchEvent(event: string, data: any) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(listener => listener(data))
    }
  }

  // Utility methods for testing
  simulateMessage(data: any) {
    this.dispatchEvent('message', { data: JSON.stringify(data) })
  }

  simulateError(error: any) {
    this.dispatchEvent('error', error)
  }

  simulateClose() {
    this._readyState = WebSocket.CLOSED
    this.dispatchEvent('close', null)
  }
}

// Mock localStorage for testing
export const createMockLocalStorage = () => {
  const storage: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key]
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key])
    }),
    key: vi.fn((index: number) => Object.keys(storage)[index] || null),
    get length() {
      return Object.keys(storage).length
    }
  }
}

// Mock file for upload testing
export const createMockFile = (
  content = 'test content',
  filename = 'test.txt',
  type = 'text/plain'
) => {
  return new File([content], filename, { type })
}

// Wait utility for async testing
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Test assertion helpers
export const expectToastMessage = (container: HTMLElement, type: string, message: string) => {
  const toast = container.querySelector(`[data-testid="toast-${type}"]`)
  expect(toast).toBeInTheDocument()
  expect(toast).toHaveTextContent(message)
}

export const expectElementToHaveClass = (element: HTMLElement, className: string) => {
  expect(element.classList.contains(className)).toBe(true)
}

export const expectElementNotToHaveClass = (element: HTMLElement, className: string) => {
  expect(element.classList.contains(className)).toBe(false)
}

// Mock environment setup
export const setupTestEnvironment = () => {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: createMockLocalStorage()
  })

  // Mock WebSocket
  global.WebSocket = MockWebSocket as any
}

// Cleanup function
export const cleanupTestEnvironment = () => {
  vi.clearAllMocks()
  vi.clearAllTimers()
}