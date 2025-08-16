import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import React from 'react'

// Import actual UI components
import Button from '../../src/components/ui/Button'
import Input from '../../src/components/ui/Input'
import Card from '../../src/components/ui/Card'
import Badge from '../../src/components/ui/Badge'
import Toggle from '../../src/components/ui/Toggle'
import ThemeToggle from '../../src/components/ui/ThemeToggle'
import Select from '../../src/components/ui/Select'
import Checkbox from '../../src/components/ui/Checkbox'

// Mock theme context
const mockThemeContext = {
  theme: 'dark',
  toggleTheme: vi.fn(),
  setTheme: vi.fn()
}

// Wrap components that need theme context
const WithMockTheme: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div data-theme={mockThemeContext.theme}>
      {children}
    </div>
  )
}

describe('UI Components', () => {
  describe('Button Component', () => {
    test('renders with default props', () => {
      render(<Button>Click me</Button>)
      
      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('Click me')
    })

    test('handles click events', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    test('can be disabled', () => {
      render(<Button disabled>Disabled button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    test('applies custom className', () => {
      render(<Button className="custom-class">Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })

    test('supports different variants', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>)
      let button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'primary')

      rerender(<Button variant="secondary">Secondary</Button>)
      button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-variant', 'secondary')
    })
  })

  describe('Input Component', () => {
    test('renders input field', () => {
      render(<Input placeholder="Enter text" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', 'Enter text')
    })

    test('handles value changes', () => {
      const handleChange = vi.fn()
      render(<Input onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'test value' } })
      
      expect(handleChange).toHaveBeenCalled()
    })

    test('can be disabled', () => {
      render(<Input disabled />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })

    test('supports different types', () => {
      render(<Input type="password" />)
      
      const input = screen.getByDisplayValue('')
      expect(input).toHaveAttribute('type', 'password')
    })
  })

  describe('Card Component', () => {
    test('renders card with children', () => {
      render(
        <Card>
          <h2>Card Title</h2>
          <p>Card content</p>
        </Card>
      )
      
      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByText('Card content')).toBeInTheDocument()
    })

    test('applies custom className', () => {
      render(<Card className="custom-card">Content</Card>)
      
      const card = screen.getByText('Content').closest('div')
      expect(card).toHaveClass('custom-card')
    })

    test('handles click events when interactive', () => {
      const handleClick = vi.fn()
      render(<Card onClick={handleClick}>Clickable card</Card>)
      
      const card = screen.getByText('Clickable card').closest('div')
      fireEvent.click(card!)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Badge Component', () => {
    test('renders badge with text', () => {
      render(<Badge>New</Badge>)
      
      expect(screen.getByText('New')).toBeInTheDocument()
    })

    test('supports different variants', () => {
      const { rerender } = render(<Badge variant="success">Success</Badge>)
      let badge = screen.getByText('Success')
      expect(badge).toHaveClass('bg-green-500')

      rerender(<Badge variant="error">Error</Badge>)
      badge = screen.getByText('Error')
      expect(badge).toHaveClass('bg-red-500')

      rerender(<Badge variant="warning">Warning</Badge>)
      badge = screen.getByText('Warning')
      expect(badge).toHaveClass('bg-yellow-500')
    })

    test('applies custom className', () => {
      render(<Badge className="custom-badge">Badge</Badge>)
      
      const badge = screen.getByText('Badge')
      expect(badge).toHaveClass('custom-badge')
    })
  })

  describe('Toggle Component', () => {
    test('renders toggle switch', () => {
      render(<Toggle checked={false} onChange={vi.fn()} />)
      
      const toggle = screen.getByRole('checkbox')
      expect(toggle).toBeInTheDocument()
      expect(toggle).not.toBeChecked()
    })

    test('handles state changes', () => {
      const handleChange = vi.fn()
      render(<Toggle checked={false} onChange={handleChange} />)
      
      const toggle = screen.getByRole('checkbox')
      fireEvent.click(toggle)
      
      expect(handleChange).toHaveBeenCalledWith(true)
    })

    test('shows checked state', () => {
      render(<Toggle checked={true} onChange={vi.fn()} />)
      
      const toggle = screen.getByRole('checkbox')
      expect(toggle).toBeChecked()
    })

    test('can be disabled', () => {
      render(<Toggle checked={false} onChange={vi.fn()} disabled />)
      
      const toggle = screen.getByRole('checkbox')
      expect(toggle).toBeDisabled()
    })
  })

  describe('ThemeToggle Component', () => {
    test('renders theme toggle button', () => {
      render(
        <WithMockTheme>
          <ThemeToggle />
        </WithMockTheme>
      )
      
      const themeToggle = screen.getByRole('button')
      expect(themeToggle).toBeInTheDocument()
    })

    test('shows appropriate icon for theme', () => {
      render(
        <WithMockTheme>
          <ThemeToggle />
        </WithMockTheme>
      )
      
      const themeToggle = screen.getByRole('button')
      // Should show sun icon for dark theme
      expect(themeToggle).toHaveTextContent('☀️')
    })
  })

  describe('Select Component', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' }
    ]

    test('renders select with options', () => {
      render(<Select options={options} value="" onChange={vi.fn()} />)
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    test('shows selected value', () => {
      render(<Select options={options} value="option2" onChange={vi.fn()} />)
      
      const select = screen.getByRole('combobox') as HTMLSelectElement
      expect(select.value).toBe('option2')
    })

    test('handles selection changes', () => {
      const handleChange = vi.fn()
      render(<Select options={options} value="" onChange={handleChange} />)
      
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'option1' } })
      
      expect(handleChange).toHaveBeenCalledWith('option1')
    })

    test('can be disabled', () => {
      render(<Select options={options} value="" onChange={vi.fn()} disabled />)
      
      const select = screen.getByRole('combobox')
      expect(select).toBeDisabled()
    })

    test('shows placeholder when no value selected', () => {
      render(
        <Select 
          options={options} 
          value="" 
          onChange={vi.fn()} 
          placeholder="Choose an option"
        />
      )
      
      expect(screen.getByText('Choose an option')).toBeInTheDocument()
    })
  })

  describe('Checkbox Component', () => {
    test('renders checkbox', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} />)
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    test('shows checked state', () => {
      render(<Checkbox checked={true} onChange={vi.fn()} />)
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    test('handles state changes', () => {
      const handleChange = vi.fn()
      render(<Checkbox checked={false} onChange={handleChange} />)
      
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)
      
      expect(handleChange).toHaveBeenCalledWith(true)
    })

    test('can be disabled', () => {
      render(<Checkbox checked={false} onChange={vi.fn()} disabled />)
      
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeDisabled()
    })

    test('shows label when provided', () => {
      render(
        <Checkbox 
          checked={false} 
          onChange={vi.fn()} 
          label="Accept terms"
        />
      )
      
      expect(screen.getByText('Accept terms')).toBeInTheDocument()
    })

    test('supports intermediate state', () => {
      render(
        <Checkbox 
          checked={false} 
          onChange={vi.fn()} 
          indeterminate={true}
        />
      )
      
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.indeterminate).toBe(true)
    })
  })
})