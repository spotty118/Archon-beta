/**
 * Comprehensive tests for Button component
 * Tests all variants, sizes, states, and accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { Button } from '../../../src/components/ui/Button'

describe('Button Component', () => {
  test('renders with default props', () => {
    render(<Button>Default Button</Button>)
    
    const button = screen.getByRole('button', { name: 'Default Button' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('inline-flex')
  })

  test('handles click events', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('disabled state prevents clicks', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Disabled Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  test('supports different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  test('supports different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(<Button size="md">Medium</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  test('loading state', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Loading Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Loading Button')
    
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  test('custom className is applied', () => {
    render(<Button className="custom-class">Custom Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Button ref={ref}>Ref Button</Button>)
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
  })

  test('accessibility attributes', () => {
    render(
      <Button 
        aria-label="Accessible button"
        aria-describedby="button-help"
        title="Button tooltip"
      >
        Button
      </Button>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Accessible button')
    expect(button).toHaveAttribute('aria-describedby', 'button-help')
    expect(button).toHaveAttribute('title', 'Button tooltip')
  })

  test('keyboard navigation', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Keyboard Button</Button>)
    
    const button = screen.getByRole('button')
    button.focus()
    
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
    
    fireEvent.keyDown(button, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  test('supports as prop for polymorphic behavior', () => {
    render(<Button as="a" href="/test">Link Button</Button>)
    
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/test')
  })

  test('supports icon rendering', () => {
    const Icon = () => <span data-testid="icon">🚀</span>
    render(
      <Button>
        <Icon />
        Button with icon
      </Button>
    )
    
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('Button with icon')).toBeInTheDocument()
  })
})