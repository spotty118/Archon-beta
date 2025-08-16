import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// Mock Settings Components
const MockSettingsPage = () => {
  const [settings, setSettings] = React.useState({
    theme: 'dark',
    notifications: true,
    autoSave: false,
    llmProvider: 'openai',
    projectsEnabled: true,
    debugMode: false
  })

  const [apiKeys, setApiKeys] = React.useState([
    { key: 'OPENAI_API_KEY', value: 'sk-test123', encrypted: false },
    { key: 'GOOGLE_API_KEY', value: '', encrypted: false }
  ])

  const [isSaving, setIsSaving] = React.useState(false)
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle')

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleApiKeyChange = (keyName: string, value: string) => {
    setApiKeys(prev => prev.map(k => 
      k.key === keyName ? { ...k, value } : k
    ))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 500)
  }

  const handleReset = () => {
    setSettings({
      theme: 'dark',
      notifications: true,
      autoSave: false,
      llmProvider: 'openai',
      projectsEnabled: true,
      debugMode: false
    })
    setApiKeys([
      { key: 'OPENAI_API_KEY', value: '', encrypted: false },
      { key: 'GOOGLE_API_KEY', value: '', encrypted: false }
    ])
  }

  const handleEncryptKey = (keyName: string) => {
    setApiKeys(prev => prev.map(k => 
      k.key === keyName ? { ...k, encrypted: !k.encrypted } : k
    ))
  }

  return (
    <div data-testid="settings-page">
      <h1>Settings</h1>

      {/* General Settings */}
      <section data-testid="general-settings">
        <h2>General</h2>
        
        <div data-testid="theme-setting">
          <label>Theme</label>
          <select 
            value={settings.theme}
            onChange={(e) => handleSettingChange('theme', e.target.value)}
            data-testid="theme-select"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div data-testid="notifications-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => handleSettingChange('notifications', e.target.checked)}
              data-testid="notifications-checkbox"
            />
            Enable Notifications
          </label>
        </div>

        <div data-testid="autosave-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.autoSave}
              onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
              data-testid="autosave-checkbox"
            />
            Auto Save
          </label>
        </div>

        <div data-testid="projects-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.projectsEnabled}
              onChange={(e) => handleSettingChange('projectsEnabled', e.target.checked)}
              data-testid="projects-checkbox"
            />
            Enable Projects Feature
          </label>
        </div>

        <div data-testid="debug-setting">
          <label>
            <input
              type="checkbox"
              checked={settings.debugMode}
              onChange={(e) => handleSettingChange('debugMode', e.target.checked)}
              data-testid="debug-checkbox"
            />
            Debug Mode
          </label>
        </div>
      </section>

      {/* LLM Provider Settings */}
      <section data-testid="llm-settings">
        <h2>Language Model Provider</h2>
        
        <div data-testid="llm-provider-setting">
          <label>Provider</label>
          <select 
            value={settings.llmProvider}
            onChange={(e) => handleSettingChange('llmProvider', e.target.value)}
            data-testid="llm-provider-select"
          >
            <option value="openai">OpenAI</option>
            <option value="google">Google Gemini</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
        </div>

        <div data-testid="provider-description">
          {settings.llmProvider === 'openai' && (
            <p data-testid="openai-description">
              OpenAI GPT models - requires API key
            </p>
          )}
          {settings.llmProvider === 'google' && (
            <p data-testid="google-description">
              Google Gemini models - requires API key
            </p>
          )}
          {settings.llmProvider === 'ollama' && (
            <p data-testid="ollama-description">
              Local Ollama models - no API key required
            </p>
          )}
        </div>
      </section>

      {/* API Keys */}
      <section data-testid="api-keys-settings">
        <h2>API Keys</h2>
        
        {apiKeys.map(apiKey => (
          <div key={apiKey.key} data-testid={`api-key-${apiKey.key.toLowerCase()}`}>
            <label>{apiKey.key}</label>
            <div className="api-key-row">
              <input
                type={apiKey.encrypted ? 'password' : 'text'}
                value={apiKey.value}
                onChange={(e) => handleApiKeyChange(apiKey.key, e.target.value)}
                placeholder={`Enter ${apiKey.key}`}
                data-testid={`${apiKey.key.toLowerCase()}-input`}
              />
              <button
                onClick={() => handleEncryptKey(apiKey.key)}
                data-testid={`${apiKey.key.toLowerCase()}-encrypt`}
              >
                {apiKey.encrypted ? 'Show' : 'Hide'}
              </button>
            </div>
            <div data-testid={`${apiKey.key.toLowerCase()}-status`}>
              Status: {apiKey.value ? 'Configured' : 'Not set'}
            </div>
          </div>
        ))}
      </section>

      {/* Actions */}
      <section data-testid="settings-actions">
        <button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="save-btn"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        
        <button
          onClick={handleReset}
          data-testid="reset-btn"
        >
          Reset to Defaults
        </button>

        {saveStatus === 'success' && (
          <div data-testid="save-success">Settings saved successfully!</div>
        )}
        
        {saveStatus === 'error' && (
          <div data-testid="save-error">Failed to save settings</div>
        )}
      </section>

      {/* Current Configuration Display */}
      <section data-testid="config-display">
        <h3>Current Configuration</h3>
        <pre data-testid="config-json">
          {JSON.stringify(settings, null, 2)}
        </pre>
      </section>
    </div>
  )
}

const MockThemeToggle = () => {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark')

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <button 
      onClick={toggleTheme}
      data-testid="theme-toggle"
      className={`theme-toggle ${theme}`}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}

describe('Settings Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders settings page with all sections', () => {
    render(<MockSettingsPage />)
    
    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByTestId('general-settings')).toBeInTheDocument()
    expect(screen.getByTestId('llm-settings')).toBeInTheDocument()
    expect(screen.getByTestId('api-keys-settings')).toBeInTheDocument()
    expect(screen.getByTestId('settings-actions')).toBeInTheDocument()
  })

  test('theme selection works correctly', () => {
    render(<MockSettingsPage />)
    
    const themeSelect = screen.getByTestId('theme-select') as HTMLSelectElement
    
    expect(themeSelect.value).toBe('dark')
    
    fireEvent.change(themeSelect, { target: { value: 'light' } })
    
    expect(themeSelect.value).toBe('light')
  })

  test('notification toggle works', () => {
    render(<MockSettingsPage />)
    
    const notificationsCheckbox = screen.getByTestId('notifications-checkbox') as HTMLInputElement
    
    expect(notificationsCheckbox.checked).toBe(true)
    
    fireEvent.click(notificationsCheckbox)
    
    expect(notificationsCheckbox.checked).toBe(false)
  })

  test('auto save toggle works', () => {
    render(<MockSettingsPage />)
    
    const autoSaveCheckbox = screen.getByTestId('autosave-checkbox') as HTMLInputElement
    
    expect(autoSaveCheckbox.checked).toBe(false)
    
    fireEvent.click(autoSaveCheckbox)
    
    expect(autoSaveCheckbox.checked).toBe(true)
  })

  test('projects feature toggle works', () => {
    render(<MockSettingsPage />)
    
    const projectsCheckbox = screen.getByTestId('projects-checkbox') as HTMLInputElement
    
    expect(projectsCheckbox.checked).toBe(true)
    
    fireEvent.click(projectsCheckbox)
    
    expect(projectsCheckbox.checked).toBe(false)
  })

  test('debug mode toggle works', () => {
    render(<MockSettingsPage />)
    
    const debugCheckbox = screen.getByTestId('debug-checkbox') as HTMLInputElement
    
    expect(debugCheckbox.checked).toBe(false)
    
    fireEvent.click(debugCheckbox)
    
    expect(debugCheckbox.checked).toBe(true)
  })

  test('LLM provider selection and descriptions', () => {
    render(<MockSettingsPage />)
    
    const providerSelect = screen.getByTestId('llm-provider-select') as HTMLSelectElement
    
    expect(providerSelect.value).toBe('openai')
    expect(screen.getByTestId('openai-description')).toBeInTheDocument()
    
    // Switch to Google
    fireEvent.change(providerSelect, { target: { value: 'google' } })
    
    expect(providerSelect.value).toBe('google')
    expect(screen.getByTestId('google-description')).toBeInTheDocument()
    expect(screen.queryByTestId('openai-description')).not.toBeInTheDocument()
    
    // Switch to Ollama
    fireEvent.change(providerSelect, { target: { value: 'ollama' } })
    
    expect(providerSelect.value).toBe('ollama')
    expect(screen.getByTestId('ollama-description')).toBeInTheDocument()
    expect(screen.queryByTestId('google-description')).not.toBeInTheDocument()
  })

  test('API key input and management', () => {
    render(<MockSettingsPage />)
    
    const openaiInput = screen.getByTestId('openai_api_key-input') as HTMLInputElement
    const googleInput = screen.getByTestId('google_api_key-input') as HTMLInputElement
    
    expect(openaiInput.value).toBe('sk-test123')
    expect(googleInput.value).toBe('')
    
    // Test OpenAI key status
    expect(screen.getByTestId('openai_api_key-status')).toHaveTextContent('Status: Configured')
    expect(screen.getByTestId('google_api_key-status')).toHaveTextContent('Status: Not set')
    
    // Change Google API key
    fireEvent.change(googleInput, { target: { value: 'google-api-key-123' } })
    
    expect(googleInput.value).toBe('google-api-key-123')
    expect(screen.getByTestId('google_api_key-status')).toHaveTextContent('Status: Configured')
  })

  test('API key encryption toggle', () => {
    render(<MockSettingsPage />)
    
    const openaiInput = screen.getByTestId('openai_api_key-input') as HTMLInputElement
    const encryptBtn = screen.getByTestId('openai_api_key-encrypt')
    
    expect(openaiInput.type).toBe('text')
    expect(encryptBtn).toHaveTextContent('Hide')
    
    // Click encrypt button
    fireEvent.click(encryptBtn)
    
    expect(openaiInput.type).toBe('password')
    expect(encryptBtn).toHaveTextContent('Show')
    
    // Click again to show
    fireEvent.click(encryptBtn)
    
    expect(openaiInput.type).toBe('text')
    expect(encryptBtn).toHaveTextContent('Hide')
  })

  test('save functionality with loading state', async () => {
    render(<MockSettingsPage />)
    
    const saveBtn = screen.getByTestId('save-btn')
    
    expect(saveBtn).toHaveTextContent('Save Settings')
    expect(saveBtn).not.toBeDisabled()
    
    fireEvent.click(saveBtn)
    
    // Should show loading state
    expect(saveBtn).toHaveTextContent('Saving...')
    expect(saveBtn).toBeDisabled()
    
    // Wait for save to complete
    await waitFor(() => {
      expect(saveBtn).toHaveTextContent('Save Settings')
      expect(saveBtn).not.toBeDisabled()
      expect(screen.getByTestId('save-success')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  test('reset to defaults functionality', () => {
    render(<MockSettingsPage />)
    
    // Change some settings
    fireEvent.click(screen.getByTestId('notifications-checkbox'))
    fireEvent.click(screen.getByTestId('autosave-checkbox'))
    fireEvent.change(screen.getByTestId('theme-select'), { target: { value: 'light' } })
    
    // Verify changes
    expect((screen.getByTestId('notifications-checkbox') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByTestId('autosave-checkbox') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('theme-select') as HTMLSelectElement).value).toBe('light')
    
    // Reset
    fireEvent.click(screen.getByTestId('reset-btn'))
    
    // Should be back to defaults
    expect((screen.getByTestId('notifications-checkbox') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('autosave-checkbox') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByTestId('theme-select') as HTMLSelectElement).value).toBe('dark')
  })

  test('configuration display updates', () => {
    render(<MockSettingsPage />)
    
    const configDisplay = screen.getByTestId('config-json')
    
    // Should show current config
    expect(configDisplay).toHaveTextContent('"theme": "dark"')
    expect(configDisplay).toHaveTextContent('"notifications": true')
    
    // Change theme
    fireEvent.change(screen.getByTestId('theme-select'), { target: { value: 'light' } })
    
    // Config should update
    expect(configDisplay).toHaveTextContent('"theme": "light"')
  })

  test('theme toggle component works independently', () => {
    render(<MockThemeToggle />)
    
    const themeToggle = screen.getByTestId('theme-toggle')
    
    expect(themeToggle).toHaveTextContent('☀️')
    expect(themeToggle).toHaveClass('dark')
    
    fireEvent.click(themeToggle)
    
    expect(themeToggle).toHaveTextContent('🌙')
    expect(themeToggle).toHaveClass('light')
  })

  test('all form controls are accessible', () => {
    render(<MockSettingsPage />)
    
    // Check that all form controls have proper labels/accessibility
    expect(screen.getByLabelText('Theme')).toBeInTheDocument()
    expect(screen.getByLabelText('Provider')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Notifications')).toBeInTheDocument()
    expect(screen.getByLabelText('Auto Save')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Projects Feature')).toBeInTheDocument()
    expect(screen.getByLabelText('Debug Mode')).toBeInTheDocument()
  })
})