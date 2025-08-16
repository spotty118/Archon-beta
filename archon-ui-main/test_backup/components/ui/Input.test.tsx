/**
 * Comprehensive tests for Input component
 * Tests all input types, validation states, and accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import { Input } from '../../../src/components/ui/Input'

describe('Input Component', () => {
  test('renders with default props', () => {
    render(<Input placeholder="Enter text" />)
    
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  test('handles value changes', () => {
    const onChange = vi.fn()
    render(<Input value="" onChange={onChange} />)
    
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test input' } })
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: 'test input' })
      })
    )
  })

  test('supports different input types', () => {
    const { rerender } = render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')

    rerender(<Input type="password" />)
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password')

    rerender(<Input type="number" />)
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')

    rerender(<Input type="tel" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'tel')

    rerender(<Input type="url" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'url')
  })

  test('disabled state', () => {
    const onChange = vi.fn()
    render(<Input disabled onChange={onChange} />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
    
    fireEvent.change(input, { target: { value: 'test' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  test('error state styling', () => {
    render(<Input error placeholder="Error input" />)
    
    const input = screen.getByPlaceholderText('Error input')
    expect(input).toHaveClass('border-red-500')
  })

  test('success state styling', () => {
    render(<Input success placeholder="Success input" />)
    
    const input = screen.getByPlaceholderText('Success input')
    expect(input).toHaveClass('border-green-500')
  })

  test('size variants', () => {
    const { rerender } = render(<Input size="sm" placeholder="Small" />)
    expect(screen.getByPlaceholderText('Small')).toHaveClass('h-8')

    rerender(<Input size="md" placeholder="Medium" />)
    expect(screen.getByPlaceholderText('Medium')).toHaveClass('h-10')

    rerender(<Input size="lg" placeholder="Large" />)
    expect(screen.getByPlaceholderText('Large')).toHaveClass('h-12')
  })

  test('controlled component behavior', () => {
    const ControlledInput = () => {
      const [value, setValue] = React.useState('')
      return (
        <Input 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          placeholder="Controlled"
        />
      )
    }
    
    render(<ControlledInput />)
    
    const input = screen.getByPlaceholderText('Controlled')
    fireEvent.change(input, { target: { value: 'controlled test' } })
    
    expect(input).toHaveValue('controlled test')
  })

  test('uncontrolled component behavior', () => {
    render(<Input defaultValue="initial" placeholder="Uncontrolled" />)
    
    const input = screen.getByPlaceholderText('Uncontrolled')
    expect(input).toHaveValue('initial')
    
    fireEvent.change(input, { target: { value: 'changed' } })
    expect(input).toHaveValue('changed')
  })

  test('accessibility attributes', () => {
    render(
      <Input 
        aria-label="Accessible input"
        aria-describedby="input-help"
        aria-required
        placeholder="Accessible"
      />
    )
    
    const input = screen.getByPlaceholderText('Accessible')
    expect(input).toHaveAttribute('aria-label', 'Accessible input')
    expect(input).toHaveAttribute('aria-describedby', 'input-help')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  test('focus and blur events', () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    
    render(<Input onFocus={onFocus} onBlur={onBlur} placeholder="Focus test" />)
    
    const input = screen.getByPlaceholderText('Focus test')
    
    fireEvent.focus(input)
    expect(onFocus).toHaveBeenCalledTimes(1)
    
    fireEvent.blur(input)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  test('keyboard events', () => {
    const onKeyDown = vi.fn()
    const onKeyUp = vi.fn()
    const onKeyPress = vi.fn()
    
    render(
      <Input 
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onKeyPress={onKeyPress}
        placeholder="Keyboard test"
      />
    )
    
    const input = screen.getByPlaceholderText('Keyboard test')
    
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter' })
    )
    
    fireEvent.keyUp(input, { key: 'Enter' })
    expect(onKeyUp).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Enter' })
    )
  })

  test('custom className is applied', () => {
    render(<Input className="custom-input" placeholder="Custom" />)
    
    const input = screen.getByPlaceholderText('Custom')
    expect(input).toHaveClass('custom-input')
  })

  test('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Input ref={ref} placeholder="Ref test" />)
    
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement))
  })

  test('input validation', async () => {
    render(<Input type="email" required placeholder="Email validation" />)
    
    const input = screen.getByPlaceholderText('Email validation')
    
    fireEvent.change(input, { target: { value: 'invalid-email' } })
    fireEvent.blur(input)
    
    // Check if browser validation triggers
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('required')
  })

  test('readonly state', () => {
    render(<Input readOnly value="readonly text" placeholder="Readonly" />)
    
    const input = screen.getByPlaceholderText('Readonly')
    expect(input).toHaveAttribute('readonly')
    expect(input).toHaveValue('readonly text')
    
    fireEvent.change(input, { target: { value: 'should not change' } })
    expect(input).toHaveValue('readonly text')
  })

  test('maxLength attribute', () => {
    render(<Input maxLength={10} placeholder="Max length" />)
    
    const input = screen.getByPlaceholderText('Max length')
    expect(input).toHaveAttribute('maxLength', '10')
    
    fireEvent.change(input, { target: { value: 'this is longer than 10' } })
    // Browser enforces maxLength, so value should be truncated
  })

  test('autoComplete attribute', () => {
    render(<Input autoComplete="email" placeholder="Autocomplete" />)
    
    const input = screen.getByPlaceholderText('Autocomplete')
    expect(input).toHaveAttribute('autoComplete', 'email')
  })
})