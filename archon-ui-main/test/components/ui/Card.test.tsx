/**
 * Comprehensive tests for Card component
 * Tests layout, styling, and composition patterns
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { Card } from '../../../src/components/ui/Card'

describe('Card Component', () => {
  test('renders with default props', () => {
    render(
      <Card>
        <div>Card content</div>
      </Card>
    )
    
    const card = screen.getByText('Card content').closest('div')
    expect(card).toBeInTheDocument()
    expect(card).toHaveClass('rounded-lg')
  })

  test('applies custom className', () => {
    render(
      <Card className="custom-card">
        <div>Custom card</div>
      </Card>
    )
    
    const card = screen.getByText('Custom card').closest('div')
    expect(card).toHaveClass('custom-card')
  })

  test('supports different padding variants', () => {
    const { rerender } = render(
      <Card padding="sm">
        <div>Small padding</div>
      </Card>
    )
    
    let card = screen.getByText('Small padding').closest('div')
    expect(card).toHaveClass('p-4')
    
    rerender(
      <Card padding="md">
        <div>Medium padding</div>
      </Card>
    )
    
    card = screen.getByText('Medium padding').closest('div')
    expect(card).toHaveClass('p-6')
    
    rerender(
      <Card padding="lg">
        <div>Large padding</div>
      </Card>
    )
    
    card = screen.getByText('Large padding').closest('div')
    expect(card).toHaveClass('p-8')
  })

  test('supports hover effects', () => {
    render(
      <Card hover>
        <div>Hoverable card</div>
      </Card>
    )
    
    const card = screen.getByText('Hoverable card').closest('div')
    expect(card).toHaveClass('hover:shadow-lg')
  })

  test('supports clickable cards', () => {
    const onClick = vi.fn()
    render(
      <Card onClick={onClick} clickable>
        <div>Clickable card</div>
      </Card>
    )
    
    const card = screen.getByText('Clickable card').closest('div')
    expect(card).toHaveClass('cursor-pointer')
    
    fireEvent.click(card!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('supports different shadow variants', () => {
    const { rerender } = render(
      <Card shadow="sm">
        <div>Small shadow</div>
      </Card>
    )
    
    let card = screen.getByText('Small shadow').closest('div')
    expect(card).toHaveClass('shadow-sm')
    
    rerender(
      <Card shadow="md">
        <div>Medium shadow</div>
      </Card>
    )
    
    card = screen.getByText('Medium shadow').closest('div')
    expect(card).toHaveClass('shadow-md')
    
    rerender(
      <Card shadow="lg">
        <div>Large shadow</div>
      </Card>
    )
    
    card = screen.getByText('Large shadow').closest('div')
    expect(card).toHaveClass('shadow-lg')
  })

  test('supports border variants', () => {
    const { rerender } = render(
      <Card border>
        <div>With border</div>
      </Card>
    )
    
    let card = screen.getByText('With border').closest('div')
    expect(card).toHaveClass('border')
    
    rerender(
      <Card border={false}>
        <div>No border</div>
      </Card>
    )
    
    card = screen.getByText('No border').closest('div')
    expect(card).not.toHaveClass('border')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(
      <Card ref={ref}>
        <div>Ref card</div>
      </Card>
    )
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
  })

  test('supports card header and footer composition', () => {
    render(
      <Card>
        <div data-testid="card-header">Card Header</div>
        <div data-testid="card-content">Card Content</div>
        <div data-testid="card-footer">Card Footer</div>
      </Card>
    )
    
    expect(screen.getByTestId('card-header')).toBeInTheDocument()
    expect(screen.getByTestId('card-content')).toBeInTheDocument()
    expect(screen.getByTestId('card-footer')).toBeInTheDocument()
  })

  test('accessibility attributes', () => {
    render(
      <Card 
        role="article"
        aria-label="Article card"
        tabIndex={0}
      >
        <div>Accessible card</div>
      </Card>
    )
    
    const card = screen.getByText('Accessible card').closest('div')
    expect(card).toHaveAttribute('role', 'article')
    expect(card).toHaveAttribute('aria-label', 'Article card')
    expect(card).toHaveAttribute('tabIndex', '0')
  })

  test('keyboard navigation for clickable cards', () => {
    const onClick = vi.fn()
    render(
      <Card onClick={onClick} clickable tabIndex={0}>
        <div>Keyboard accessible card</div>
      </Card>
    )
    
    const card = screen.getByText('Keyboard accessible card').closest('div')
    card?.focus()
    
    fireEvent.keyDown(card!, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
    
    fireEvent.keyDown(card!, { key: ' ' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  test('supports complex content composition', () => {
    render(
      <Card>
        <img src="/test.jpg" alt="Test image" />
        <h2>Card Title</h2>
        <p>Card description text</p>
        <button>Action Button</button>
      </Card>
    )
    
    expect(screen.getByAltText('Test image')).toBeInTheDocument()
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card description text')).toBeInTheDocument()
    expect(screen.getByText('Action Button')).toBeInTheDocument()
  })

  test('handles long content gracefully', () => {
    const longContent = 'Lorem ipsum '.repeat(100)
    render(
      <Card>
        <div>{longContent}</div>
      </Card>
    )
    
    const card = screen.getByText(longContent, { exact: false }).closest('div')
    expect(card).toBeInTheDocument()
  })

  test('supports nested cards', () => {
    render(
      <Card data-testid="outer-card">
        <div>Outer card content</div>
        <Card data-testid="inner-card">
          <div>Inner card content</div>
        </Card>
      </Card>
    )
    
    expect(screen.getByTestId('outer-card')).toBeInTheDocument()
    expect(screen.getByTestId('inner-card')).toBeInTheDocument()
    expect(screen.getByText('Outer card content')).toBeInTheDocument()
    expect(screen.getByText('Inner card content')).toBeInTheDocument()
  })
})