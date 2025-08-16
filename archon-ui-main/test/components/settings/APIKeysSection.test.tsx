import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { APIKeysSection } from '@/components/settings/APIKeysSection'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  EyeOff: () => <div data-testid="eye-off-icon">EyeOff</div>,
  Key: () => <div data-testid="key-icon">Key</div>,
  CheckCircle: () => <div data-testid="check-icon">CheckCircle</div>,
  XCircle: () => <div data-testid="x-circle-icon">XCircle</div>,
  AlertTriangle: () => <div data-testid="alert-icon">AlertTriangle</div>,
  Save: () => <div data-testid="save-icon">Save</div>,
}))

// Mock fetch for API key validation
const mockFetch = vi.fn()
global.fetch = mockFetch

const defaultProps = {
  onSave: vi.fn(),
  onValidate: vi.fn(),
  isValidating: false
}

describe('APIKeysSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
  })

  test('renders API keys section with all providers', () => {
    render(<APIKeysSection {...defaultProps} />)
    
    expect(screen.getByText('API Configuration')).toBeInTheDocument()
    expect(screen.getByText('OpenAI API Key')).toBeInTheDocument()
    expect(screen.getByText('Anthropic API Key')).toBeInTheDocument()
    expect(screen.getByText('Google API Key')).toBeInTheDocument()
    expect(screen.getByText('Groq API Key')).toBeInTheDocument()
  })

  test('toggles password visibility for API keys', () => {
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    expect(openaiInput).toHaveAttribute('type', 'password')
    
    const toggleButton = screen.getAllByTestId('eye-icon')[0]
    fireEvent.click(toggleButton)
    
    expect(openaiInput).toHaveAttribute('type', 'text')
    expect(screen.getAllByTestId('eye-off-icon')[0]).toBeInTheDocument()
  })

  test('validates API key format', async () => {
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    
    // Test invalid format
    fireEvent.change(openaiInput, { target: { value: 'invalid-key' } })
    fireEvent.blur(openaiInput)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument()
    })
    
    // Test valid format
    fireEvent.change(openaiInput, { target: { value: 'sk-1234567890abcdef1234567890abcdef1234567890abcdef' } })
    fireEvent.blur(openaiInput)
    
    await waitFor(() => {
      expect(screen.queryByText(/invalid api key format/i)).not.toBeInTheDocument()
    })
  })

  test('validates API key with server', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: true })
    })
    
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'sk-valid1234567890abcdef1234567890abcdef1234567890' } })
    
    const validateButton = screen.getAllByText(/validate/i)[0]
    fireEvent.click(validateButton)
    
    await waitFor(() => {
      expect(defaultProps.onValidate).toHaveBeenCalledWith('openai', expect.any(String))
      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
    })
  })

  test('handles API key validation failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Invalid API key' })
    })
    
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'sk-invalid1234567890abcdef1234567890abcdef1234567890' } })
    
    const validateButton = screen.getAllByText(/validate/i)[0]
    fireEvent.click(validateButton)
    
    await waitFor(() => {
      expect(screen.getByTestId('x-circle-icon')).toBeInTheDocument()
      expect(screen.getByText(/invalid api key/i)).toBeInTheDocument()
    })
  })

  test('saves API keys to localStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'sk-test1234567890abcdef1234567890abcdef1234567890' } })
    
    const saveButton = screen.getByText(/save api keys/i)
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith('openai_api_key', expect.any(String))
      expect(defaultProps.onSave).toHaveBeenCalled()
    })
  })

  test('loads existing API keys from localStorage', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem')
    getItemSpy.mockImplementation((key) => {
      if (key === 'openai_api_key') return 'sk-existing1234567890abcdef1234567890abcdef123456'
      return null
    })
    
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    expect(openaiInput).toHaveValue('sk-existing1234567890abcdef1234567890abcdef123456')
  })

  test('shows validation status indicators', async () => {
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'sk-test1234567890abcdef1234567890abcdef1234567890' } })
    
    // Should show pending validation
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
    
    // Mock successful validation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ valid: true })
    })
    
    const validateButton = screen.getAllByText(/validate/i)[0]
    fireEvent.click(validateButton)
    
    await waitFor(() => {
      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
    })
  })

  test('handles different API key formats for different providers', () => {
    render(<APIKeysSection {...defaultProps} />)
    
    // OpenAI format: sk-...
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'sk-test1234567890' } })
    expect(openaiInput).toHaveValue('sk-test1234567890')
    
    // Anthropic format: starts with sk-ant-
    const anthropicInput = screen.getByPlaceholderText(/anthropic api key/i)
    fireEvent.change(anthropicInput, { target: { value: 'sk-ant-test1234567890' } })
    expect(anthropicInput).toHaveValue('sk-ant-test1234567890')
    
    // Google format: standard API key
    const googleInput = screen.getByPlaceholderText(/google api key/i)
    fireEvent.change(googleInput, { target: { value: 'AIzaSyTest1234567890' } })
    expect(googleInput).toHaveValue('AIzaSyTest1234567890')
  })

  test('clears API keys', async () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')
    
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'sk-test1234567890abcdef1234567890abcdef1234567890' } })
    
    const clearButton = screen.getByText(/clear all keys/i)
    fireEvent.click(clearButton)
    
    await waitFor(() => {
      expect(removeItemSpy).toHaveBeenCalledWith('openai_api_key')
      expect(openaiInput).toHaveValue('')
    })
  })

  test('shows loading state during validation', () => {
    render(<APIKeysSection {...defaultProps} isValidating={true} />)
    
    const validateButtons = screen.getAllByText(/validating/i)
    expect(validateButtons.length).toBeGreaterThan(0)
    
    validateButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  test('handles network errors during validation', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'sk-test1234567890abcdef1234567890abcdef1234567890' } })
    
    const validateButton = screen.getAllByText(/validate/i)[0]
    fireEvent.click(validateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  test('provides helpful hints for API key sources', () => {
    render(<APIKeysSection {...defaultProps} />)
    
    expect(screen.getByText(/get your openai api key/i)).toBeInTheDocument()
    expect(screen.getByText(/get your anthropic api key/i)).toBeInTheDocument()
    expect(screen.getByText(/get your google api key/i)).toBeInTheDocument()
    expect(screen.getByText(/get your groq api key/i)).toBeInTheDocument()
  })

  test('supports keyboard navigation', () => {
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    openaiInput.focus()
    
    expect(document.activeElement).toBe(openaiInput)
    
    // Tab to toggle button
    fireEvent.keyDown(openaiInput, { key: 'Tab' })
    const toggleButton = screen.getAllByTestId('eye-icon')[0]
    expect(document.activeElement).toBe(toggleButton)
  })

  test('shows security warning for API keys', () => {
    render(<APIKeysSection {...defaultProps} />)
    
    expect(screen.getByText(/keep your api keys secure/i)).toBeInTheDocument()
    expect(screen.getByText(/never share/i)).toBeInTheDocument()
  })

  test('validates all keys before saving', async () => {
    render(<APIKeysSection {...defaultProps} />)
    
    // Add invalid key
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    fireEvent.change(openaiInput, { target: { value: 'invalid' } })
    
    const saveButton = screen.getByText(/save api keys/i)
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/fix validation errors/i)).toBeInTheDocument()
      expect(defaultProps.onSave).not.toHaveBeenCalled()
    })
  })

  test('handles copy/paste functionality', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
        readText: vi.fn(() => Promise.resolve('sk-pasted1234567890abcdef1234567890abcdef123456'))
      }
    })
    
    render(<APIKeysSection {...defaultProps} />)
    
    const openaiInput = screen.getByPlaceholderText(/openai api key/i)
    
    // Test paste
    fireEvent.paste(openaiInput, {
      clipboardData: {
        getData: () => 'sk-pasted1234567890abcdef1234567890abcdef123456'
      }
    })
    
    expect(openaiInput).toHaveValue('sk-pasted1234567890abcdef1234567890abcdef123456')
  })
})