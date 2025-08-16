import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import React from 'react'

// Import actual UI components with correct import syntax
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'

describe('Real UI Components', () => {
  describe('Button Component', () => {
    test('renders with children', () => {
      render(<Button>Test Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Test Button')
    })

    test('handles click events', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('can be disabled', () => {
      render(<Button disabled>Disabled</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    test('applies variant classes', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>)
      let button = screen.getByRole('button')
      expect(button).toHaveClass('bg-purple-600')

      rerender(<Button variant="secondary">Secondary</Button>)
      button = screen.getByRole('button')
      expect(button).toHaveClass('bg-gray-600')

      rerender(<Button variant="outline">Outline</Button>)
      button = screen.getByRole('button')
      expect(button).toHaveClass('border-purple-500')
    })

    test('applies size classes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>)
      let button = screen.getByRole('button')
      expect(button).toHaveClass('px-3', 'py-1', 'text-sm')

      rerender(<Button size="lg">Large</Button>)
      button = screen.getByRole('button')
      expect(button).toHaveClass('px-6', 'py-3', 'text-lg')
    })

    test('applies accent color classes', () => {
      const { rerender } = render(<Button accentColor="green">Green</Button>)
      let button = screen.getByRole('button')
      expect(button).toHaveClass('bg-green-600')

      rerender(<Button accentColor="blue">Blue</Button>)
      button = screen.getByRole('button')
      expect(button).toHaveClass('bg-blue-600')
    })

    test('shows neon line when enabled', () => {
      render(<Button neonLine>Neon Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('before:absolute')
    })

    test('displays icon when provided', () => {
      const TestIcon = () => <span data-testid="test-icon">🎯</span>
      render(<Button icon={<TestIcon />}>With Icon</Button>)
      
      expect(screen.getByTestId('test-icon')).toBeInTheDocument()
      expect(screen.getByText('With Icon')).toBeInTheDocument()
    })
  })

  describe('Badge Component', () => {
    test('renders with children', () => {
      render(<Badge>Test Badge</Badge>)
      
      const badge = screen.getByText('Test Badge')
      expect(badge).toBeInTheDocument()
    })

    test('applies variant classes', () => {
      const { rerender } = render(<Badge variant="success">Success</Badge>)
      let badge = screen.getByText('Success')
      expect(badge).toHaveClass('bg-green-500')

      rerender(<Badge variant="error">Error</Badge>)
      badge = screen.getByText('Error')
      expect(badge).toHaveClass('bg-red-500')

      rerender(<Badge variant="warning">Warning</Badge>)
      badge = screen.getByText('Warning')
      expect(badge).toHaveClass('bg-yellow-500')

      rerender(<Badge variant="info">Info</Badge>)
      badge = screen.getByText('Info')
      expect(badge).toHaveClass('bg-blue-500')
    })

    test('applies size classes', () => {
      const { rerender } = render(<Badge size="sm">Small</Badge>)
      let badge = screen.getByText('Small')
      expect(badge).toHaveClass('text-xs', 'px-2', 'py-1')

      rerender(<Badge size="lg">Large</Badge>)
      badge = screen.getByText('Large')
      expect(badge).toHaveClass('text-sm', 'px-3', 'py-1')
    })

    test('applies custom className', () => {
      render(<Badge className="custom-class">Custom</Badge>)
      
      const badge = screen.getByText('Custom')
      expect(badge).toHaveClass('custom-class')
    })

    test('handles click events when clickable', () => {
      const handleClick = vi.fn()
      render(<Badge onClick={handleClick}>Clickable</Badge>)
      
      const badge = screen.getByText('Clickable')
      fireEvent.click(badge)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })
})