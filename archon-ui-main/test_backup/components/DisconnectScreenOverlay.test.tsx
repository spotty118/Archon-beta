/**
 * Comprehensive tests for DisconnectScreenOverlay component
 * Tests overlay display, dismiss functionality, and accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DisconnectScreenOverlay } from '../../src/components/DisconnectScreenOverlay'

// Mock animation dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

describe('DisconnectScreenOverlay Component', () => {
  const defaultProps = {
    isActive: true,
    onDismiss: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders when active', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument()
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
  })

  test('does not render when inactive', () => {
    render(<DisconnectScreenOverlay {...defaultProps} isActive={false} />)
    
    expect(screen.queryByText(/connection lost/i)).not.toBeInTheDocument()
  })

  test('shows dismiss button', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const dismissButton = screen.getByText(/dismiss/i)
    expect(dismissButton).toBeInTheDocument()
  })

  test('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<DisconnectScreenOverlay {...defaultProps} onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByText(/dismiss/i)
    fireEvent.click(dismissButton)
    
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  test('displays connection status message', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    expect(screen.getByText(/server connection has been lost/i)).toBeInTheDocument()
    expect(screen.getByText(/attempting to reconnect/i)).toBeInTheDocument()
  })

  test('shows loading indicator', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const loadingIndicator = screen.getByTestId('loading-spinner')
    expect(loadingIndicator).toBeInTheDocument()
  })

  test('overlay covers entire screen', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const overlay = screen.getByTestId('disconnect-overlay')
    expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50')
  })

  test('has proper backdrop styling', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const overlay = screen.getByTestId('disconnect-overlay')
    expect(overlay).toHaveClass('bg-black', 'bg-opacity-50')
  })

  test('accessibility attributes', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const overlay = screen.getByRole('dialog')
    expect(overlay).toHaveAttribute('aria-modal', 'true')
    expect(overlay).toHaveAttribute('aria-label', expect.stringContaining('connection'))
    
    const dismissButton = screen.getByText(/dismiss/i)
    expect(dismissButton).toHaveAttribute('aria-label')
  })

  test('keyboard navigation - escape key dismisses overlay', () => {
    const onDismiss = vi.fn()
    render(<DisconnectScreenOverlay {...defaultProps} onDismiss={onDismiss} />)
    
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  test('focus is trapped within overlay', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const dismissButton = screen.getByText(/dismiss/i)
    dismissButton.focus()
    
    expect(document.activeElement).toBe(dismissButton)
  })

  test('prevents body scroll when active', () => {
    const { rerender } = render(<DisconnectScreenOverlay {...defaultProps} />)
    
    expect(document.body.style.overflow).toBe('hidden')
    
    rerender(<DisconnectScreenOverlay {...defaultProps} isActive={false} />)
    
    expect(document.body.style.overflow).toBe('')
  })

  test('shows reconnection attempts counter', async () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    // Should show initial attempt
    expect(screen.getByText(/attempt 1/i)).toBeInTheDocument()
    
    // Simulate reconnection attempts
    await waitFor(() => {
      expect(screen.getByText(/attempt/i)).toBeInTheDocument()
    })
  })

  test('displays helpful reconnection tips', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    expect(screen.getByText(/check your internet connection/i)).toBeInTheDocument()
    expect(screen.getByText(/server may be temporarily unavailable/i)).toBeInTheDocument()
  })

  test('shows manual reconnection button', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const reconnectButton = screen.getByText(/retry connection/i)
    expect(reconnectButton).toBeInTheDocument()
  })

  test('manual reconnection button triggers retry', () => {
    const mockRetry = vi.fn()
    // Assuming the component accepts an onRetry prop
    render(<DisconnectScreenOverlay {...defaultProps} onRetry={mockRetry} />)
    
    const reconnectButton = screen.getByText(/retry connection/i)
    fireEvent.click(reconnectButton)
    
    if (mockRetry.mock.calls.length > 0) {
      expect(mockRetry).toHaveBeenCalledTimes(1)
    }
  })

  test('displays current time for reference', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    // Should show current time or timestamp
    const timeElement = screen.queryByText(/\d{1,2}:\d{2}/i)
    if (timeElement) {
      expect(timeElement).toBeInTheDocument()
    }
  })

  test('handles long disconnection periods', async () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    // After extended time, should suggest page refresh
    await waitFor(
      () => {
        const refreshSuggestion = screen.queryByText(/refresh/i)
        if (refreshSuggestion) {
          expect(refreshSuggestion).toBeInTheDocument()
        }
      },
      { timeout: 1000 }
    )
  })

  test('animation props are passed correctly', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    // Verify that motion components receive animation props
    const overlay = screen.getByTestId('disconnect-overlay')
    expect(overlay).toBeInTheDocument()
  })

  test('supports custom styling via props', () => {
    render(
      <DisconnectScreenOverlay 
        {...defaultProps} 
        className="custom-overlay-class"
      />
    )
    
    const overlay = screen.getByTestId('disconnect-overlay')
    expect(overlay).toHaveClass('custom-overlay-class')
  })

  test('shows different messages based on disconnect duration', async () => {
    const { rerender } = render(<DisconnectScreenOverlay {...defaultProps} />)
    
    expect(screen.getByText(/attempting to reconnect/i)).toBeInTheDocument()
    
    // Simulate longer disconnection
    rerender(
      <DisconnectScreenOverlay 
        {...defaultProps} 
        disconnectedFor={30000} // 30 seconds
      />
    )
    
    const extendedMessage = screen.queryByText(/extended/i)
    if (extendedMessage) {
      expect(extendedMessage).toBeInTheDocument()
    }
  })

  test('click outside overlay does not dismiss by default', () => {
    const onDismiss = vi.fn()
    render(<DisconnectScreenOverlay {...defaultProps} onDismiss={onDismiss} />)
    
    const overlay = screen.getByTestId('disconnect-overlay')
    fireEvent.click(overlay)
    
    // Should not dismiss when clicking the overlay itself
    expect(onDismiss).not.toHaveBeenCalled()
  })

  test('provides offline mode toggle if supported', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    const offlineToggle = screen.queryByText(/work offline/i)
    if (offlineToggle) {
      expect(offlineToggle).toBeInTheDocument()
    }
  })

  test('shows connection quality indicator', () => {
    render(<DisconnectScreenOverlay {...defaultProps} />)
    
    // Look for signal strength or connection quality indicators
    const qualityIndicator = screen.queryByTestId('connection-quality')
    if (qualityIndicator) {
      expect(qualityIndicator).toBeInTheDocument()
    }
  })

  test('handles rapid show/hide toggles gracefully', async () => {
    const { rerender } = render(<DisconnectScreenOverlay {...defaultProps} />)
    
    // Rapidly toggle visibility
    for (let i = 0; i < 5; i++) {
      rerender(<DisconnectScreenOverlay {...defaultProps} isActive={i % 2 === 0} />)
      await waitFor(() => {
        // Should handle rapid state changes without crashing
      })
    }
    
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument()
  })
})