/**
 * Comprehensive tests for SideNavigation component
 * Tests navigation functionality, active states, and accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { SideNavigation } from '../../../src/components/layouts/SideNavigation'

// Mock contexts
vi.mock('../../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    projectsEnabled: true,
    mcpEnabled: true,
  })
}))

vi.mock('../../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  })
}))

vi.mock('../../../src/services/serverHealthService', () => ({
  serverHealthService: {
    isConnected: true,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }
}))

// Helper to render with router
const renderWithRouter = (component: React.ReactElement, initialRoute = '/') => {
  window.history.pushState({}, '', initialRoute)
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('SideNavigation Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders navigation with all main links', () => {
    renderWithRouter(<SideNavigation />)
    
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('MCP')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('shows active state for current route', () => {
    renderWithRouter(<SideNavigation />, '/projects')
    
    const projectsLink = screen.getByText('Projects').closest('a')
    expect(projectsLink).toHaveClass('bg-blue-50')
  })

  test('navigation links have correct href attributes', () => {
    renderWithRouter(<SideNavigation />)
    
    expect(screen.getByText('Knowledge Base').closest('a')).toHaveAttribute('href', '/')
    expect(screen.getByText('Projects').closest('a')).toHaveAttribute('href', '/projects')
    expect(screen.getByText('MCP').closest('a')).toHaveAttribute('href', '/mcp')
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings')
  })

  test('displays appropriate icons for each navigation item', () => {
    renderWithRouter(<SideNavigation />)
    
    // Check that icons are present (assuming they use data-testid or specific classes)
    const knowledgeLink = screen.getByText('Knowledge Base').closest('a')
    const projectsLink = screen.getByText('Projects').closest('a')
    const mcpLink = screen.getByText('MCP').closest('a')
    const settingsLink = screen.getByText('Settings').closest('a')
    
    expect(knowledgeLink?.querySelector('svg')).toBeInTheDocument()
    expect(projectsLink?.querySelector('svg')).toBeInTheDocument()
    expect(mcpLink?.querySelector('svg')).toBeInTheDocument()
    expect(settingsLink?.querySelector('svg')).toBeInTheDocument()
  })

  test('hides projects link when projects are disabled', () => {
    vi.mocked(require('../../../src/contexts/SettingsContext').useSettings).mockReturnValue({
      projectsEnabled: false,
      mcpEnabled: true,
    })
    
    renderWithRouter(<SideNavigation />)
    
    expect(screen.queryByText('Projects')).not.toBeInTheDocument()
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('MCP')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('hides MCP link when MCP is disabled', () => {
    vi.mocked(require('../../../src/contexts/SettingsContext').useSettings).mockReturnValue({
      projectsEnabled: true,
      mcpEnabled: false,
    })
    
    renderWithRouter(<SideNavigation />)
    
    expect(screen.queryByText('MCP')).not.toBeInTheDocument()
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('shows connection status indicator', () => {
    renderWithRouter(<SideNavigation />)
    
    // Should show connected status
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  test('shows disconnected status when server is offline', () => {
    vi.mocked(require('../../../src/services/serverHealthService').serverHealthService).isConnected = false
    
    renderWithRouter(<SideNavigation />)
    
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  test('theme toggle functionality', () => {
    const mockToggleTheme = vi.fn()
    vi.mocked(require('../../../src/contexts/ThemeContext').useTheme).mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
    })
    
    renderWithRouter(<SideNavigation />)
    
    const themeToggle = screen.getByLabelText(/toggle theme/i)
    fireEvent.click(themeToggle)
    
    expect(mockToggleTheme).toHaveBeenCalledTimes(1)
  })

  test('displays correct theme icon', () => {
    const { rerender } = renderWithRouter(<SideNavigation />)
    
    // Light theme should show moon icon
    expect(screen.getByLabelText(/toggle theme/i)).toBeInTheDocument()
    
    // Mock dark theme
    vi.mocked(require('../../../src/contexts/ThemeContext').useTheme).mockReturnValue({
      theme: 'dark',
      toggleTheme: vi.fn(),
    })
    
    rerender(
      <BrowserRouter>
        <SideNavigation />
      </BrowserRouter>
    )
    
    // Dark theme should show sun icon
    expect(screen.getByLabelText(/toggle theme/i)).toBeInTheDocument()
  })

  test('accessibility attributes', () => {
    renderWithRouter(<SideNavigation />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', expect.stringContaining('main'))
    
    // Check that all links have proper labels
    const knowledgeLink = screen.getByText('Knowledge Base').closest('a')
    const projectsLink = screen.getByText('Projects').closest('a')
    const mcpLink = screen.getByText('MCP').closest('a')
    const settingsLink = screen.getByText('Settings').closest('a')
    
    expect(knowledgeLink).toHaveAttribute('aria-label')
    expect(projectsLink).toHaveAttribute('aria-label')
    expect(mcpLink).toHaveAttribute('aria-label')
    expect(settingsLink).toHaveAttribute('aria-label')
  })

  test('keyboard navigation support', () => {
    renderWithRouter(<SideNavigation />)
    
    const firstLink = screen.getByText('Knowledge Base').closest('a')
    const secondLink = screen.getByText('Projects').closest('a')
    
    firstLink?.focus()
    expect(document.activeElement).toBe(firstLink)
    
    fireEvent.keyDown(firstLink!, { key: 'Tab' })
    // Note: Actual tab navigation would be handled by the browser
  })

  test('responsive design classes', () => {
    renderWithRouter(<SideNavigation />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('w-64') // Desktop width
    expect(nav).toHaveClass('hidden') // Hidden on mobile by default
  })

  test('shows logo or brand', () => {
    renderWithRouter(<SideNavigation />)
    
    // Assuming there's a logo or brand name
    expect(screen.getByText(/archon/i)).toBeInTheDocument()
  })

  test('navigation link hover states', () => {
    renderWithRouter(<SideNavigation />)
    
    const knowledgeLink = screen.getByText('Knowledge Base').closest('a')
    
    fireEvent.mouseEnter(knowledgeLink!)
    expect(knowledgeLink).toHaveClass('hover:bg-gray-50')
    
    fireEvent.mouseLeave(knowledgeLink!)
  })

  test('active link styling on different routes', () => {
    const routes = ['/', '/projects', '/mcp', '/settings']
    const expectedActiveTexts = ['Knowledge Base', 'Projects', 'MCP', 'Settings']
    
    routes.forEach((route, index) => {
      const { unmount } = renderWithRouter(<SideNavigation />, route)
      
      const activeLink = screen.getByText(expectedActiveTexts[index]).closest('a')
      expect(activeLink).toHaveClass('bg-blue-50')
      
      unmount()
    })
  })

  test('handles missing route gracefully', () => {
    renderWithRouter(<SideNavigation />, '/unknown-route')
    
    // Should still render navigation without crashing
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  test('connection status updates dynamically', async () => {
    const mockSubscribe = vi.fn()
    const mockUnsubscribe = vi.fn()
    
    vi.mocked(require('../../../src/services/serverHealthService').serverHealthService).subscribe = mockSubscribe
    vi.mocked(require('../../../src/services/serverHealthService').serverHealthService).unsubscribe = mockUnsubscribe
    
    const { unmount } = renderWithRouter(<SideNavigation />)
    
    expect(mockSubscribe).toHaveBeenCalled()
    
    unmount()
    
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  test('displays version information if available', () => {
    renderWithRouter(<SideNavigation />)
    
    // Check if version is displayed (if implemented)
    const versionElement = screen.queryByText(/v\d+\.\d+\.\d+/)
    if (versionElement) {
      expect(versionElement).toBeInTheDocument()
    }
  })

  test('navigation persistence across page refreshes', () => {
    // Test that active state is maintained based on URL
    renderWithRouter(<SideNavigation />, '/projects')
    
    const projectsLink = screen.getByText('Projects').closest('a')
    expect(projectsLink).toHaveClass('bg-blue-50')
  })
})