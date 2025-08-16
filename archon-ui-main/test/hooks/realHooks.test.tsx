import { renderHook, act } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Import actual hooks
import { useNeonGlow } from '../../src/hooks/useNeonGlow'
import { useCardTilt } from '../../src/hooks/useCardTilt'
import { useStaggeredEntrance } from '../../src/hooks/useStaggeredEntrance'
import { useTerminalScroll } from '../../src/hooks/useTerminalScroll'

describe('Real Custom Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useNeonGlow', () => {
    test('initializes with default values', () => {
      const { result } = renderHook(() => useNeonGlow())

      expect(result.current.isActive).toBe(false)
      expect(result.current.intensity).toBe(0.5)
      expect(typeof result.current.activate).toBe('function')
      expect(typeof result.current.deactivate).toBe('function')
      expect(typeof result.current.setIntensity).toBe('function')
    })

    test('initializes with custom intensity', () => {
      const { result } = renderHook(() => useNeonGlow(0.8))

      expect(result.current.intensity).toBe(0.8)
    })

    test('activates and deactivates glow', () => {
      const { result } = renderHook(() => useNeonGlow())

      act(() => {
        result.current.activate()
      })

      expect(result.current.isActive).toBe(true)

      act(() => {
        result.current.deactivate()
      })

      expect(result.current.isActive).toBe(false)
    })

    test('updates intensity correctly', () => {
      const { result } = renderHook(() => useNeonGlow())

      act(() => {
        result.current.setIntensity(0.9)
      })

      expect(result.current.intensity).toBe(0.9)
    })

    test('clamps intensity to valid range', () => {
      const { result } = renderHook(() => useNeonGlow())

      act(() => {
        result.current.setIntensity(1.5) // Should clamp to 1
      })

      expect(result.current.intensity).toBe(1)

      act(() => {
        result.current.setIntensity(-0.5) // Should clamp to 0
      })

      expect(result.current.intensity).toBe(0)
    })

    test('generates correct glow styles', () => {
      const { result } = renderHook(() => useNeonGlow(0.6))

      act(() => {
        result.current.activate()
      })

      const styles = result.current.glowStyle
      expect(styles.boxShadow).toContain('0 0 12px')
      expect(styles.boxShadow).toContain('rgba(0, 255, 255, 0.6)')
    })
  })

  describe('useCardTilt', () => {
    test('initializes with default values', () => {
      const { result } = renderHook(() => useCardTilt())

      expect(result.current.tiltX).toBe(0)
      expect(result.current.tiltY).toBe(0)
      expect(result.current.isHovered).toBe(false)
      expect(typeof result.current.onMouseMove).toBe('function')
      expect(typeof result.current.onMouseEnter).toBe('function')
      expect(typeof result.current.onMouseLeave).toBe('function')
    })

    test('handles mouse enter', () => {
      const { result } = renderHook(() => useCardTilt())

      act(() => {
        result.current.onMouseEnter()
      })

      expect(result.current.isHovered).toBe(true)
    })

    test('handles mouse leave', () => {
      const { result } = renderHook(() => useCardTilt())

      act(() => {
        result.current.onMouseEnter()
        result.current.onMouseLeave()
      })

      expect(result.current.isHovered).toBe(false)
      expect(result.current.tiltX).toBe(0)
      expect(result.current.tiltY).toBe(0)
    })

    test('generates correct transform style', () => {
      const { result } = renderHook(() => useCardTilt())

      const style = result.current.style
      expect(style.transform).toContain('perspective(1000px)')
      expect(style.transform).toContain('rotateX(0deg)')
      expect(style.transform).toContain('rotateY(0deg)')
    })
  })

  describe('useStaggeredEntrance', () => {
    test('initializes with correct values', () => {
      const { result } = renderHook(() => useStaggeredEntrance(5))

      expect(result.current.visibleItems).toEqual(new Set())
      expect(result.current.isComplete).toBe(false)
      expect(typeof result.current.startAnimation).toBe('function')
      expect(typeof result.current.resetAnimation).toBe('function')
      expect(typeof result.current.isItemVisible).toBe('function')
    })

    test('starts animation progressively', async () => {
      vi.useFakeTimers()
      const { result } = renderHook(() => useStaggeredEntrance(3, 100))

      act(() => {
        result.current.startAnimation()
      })

      // First item should be visible immediately
      expect(result.current.isItemVisible(0)).toBe(true)
      expect(result.current.isItemVisible(1)).toBe(false)

      // Second item after delay
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.isItemVisible(1)).toBe(true)
      expect(result.current.isItemVisible(2)).toBe(false)

      // Third item after another delay
      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.isItemVisible(2)).toBe(true)

      vi.useRealTimers()
    })

    test('resets animation correctly', () => {
      const { result } = renderHook(() => useStaggeredEntrance(3))

      act(() => {
        result.current.startAnimation()
        result.current.resetAnimation()
      })

      expect(result.current.visibleItems).toEqual(new Set())
      expect(result.current.isComplete).toBe(false)
    })
  })

  describe('useTerminalScroll', () => {
    test('initializes with empty lines', () => {
      const { result } = renderHook(() => useTerminalScroll())

      expect(result.current.lines).toEqual([])
      expect(result.current.isAutoScrolling).toBe(true)
      expect(typeof result.current.addLine).toBe('function')
      expect(typeof result.current.addLines).toBe('function')
      expect(typeof result.current.clearLines).toBe('function')
      expect(typeof result.current.scrollToBottom).toBe('function')
    })

    test('adds single line', () => {
      const { result } = renderHook(() => useTerminalScroll())

      act(() => {
        result.current.addLine('Test line 1')
      })

      expect(result.current.lines).toEqual(['Test line 1'])
    })

    test('adds multiple lines', () => {
      const { result } = renderHook(() => useTerminalScroll())

      act(() => {
        result.current.addLines(['Line 1', 'Line 2', 'Line 3'])
      })

      expect(result.current.lines).toEqual(['Line 1', 'Line 2', 'Line 3'])
    })

    test('accumulates lines correctly', () => {
      const { result } = renderHook(() => useTerminalScroll())

      act(() => {
        result.current.addLine('First line')
        result.current.addLine('Second line')
        result.current.addLines(['Third line', 'Fourth line'])
      })

      expect(result.current.lines).toEqual([
        'First line',
        'Second line',
        'Third line',
        'Fourth line'
      ])
    })

    test('clears all lines', () => {
      const { result } = renderHook(() => useTerminalScroll())

      act(() => {
        result.current.addLines(['Line 1', 'Line 2'])
        result.current.clearLines()
      })

      expect(result.current.lines).toEqual([])
    })

    test('maintains line limit when specified', () => {
      const { result } = renderHook(() => useTerminalScroll(3))

      act(() => {
        result.current.addLines(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'])
      })

      expect(result.current.lines).toHaveLength(3)
      expect(result.current.lines).toEqual(['Line 3', 'Line 4', 'Line 5'])
    })

    test('handles auto-scroll setting', () => {
      const { result } = renderHook(() => useTerminalScroll(100, false))

      expect(result.current.isAutoScrolling).toBe(false)

      act(() => {
        result.current.setAutoScroll(true)
      })

      expect(result.current.isAutoScrolling).toBe(true)
    })
  })
})