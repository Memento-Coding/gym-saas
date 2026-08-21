import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { render, screen } from '@testing-library/react'

// =============================================================================
// Test 1: Property-based testing con fast-check
// Verifica que el entorno de PBT funciona correctamente
// =============================================================================

describe('fast-check: entorno de property-based testing', () => {
  it('valida la conmutatividad de la suma (a + b === b + a)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a)
      }),
      { numRuns: 100 }
    )
  })

  it('valida la asociatividad de la suma ((a + b) + c === a + (b + c))', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        (a, b, c) => {
          expect((a + b) + c).toBe(a + (b + c))
        }
      ),
      { numRuns: 100 }
    )
  })
})

// =============================================================================
// Test 2: React Testing Library con componente de shadcn/ui (Button)
// Verifica que el entorno de renderizado de componentes funciona
// =============================================================================

describe('React Testing Library: renderizado de componentes', () => {
  it('renderiza un botón y verifica que está en el documento', () => {
    render(<button type="button">Guardar</button>)

    const button = screen.getByRole('button', { name: /guardar/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Guardar')
  })

  it('renderiza un componente React funcional correctamente', () => {
    function TestCard({ title }: { title: string }) {
      return (
        <div role="article" aria-label={title}>
          <h2>{title}</h2>
          <p>Contenido de prueba</p>
        </div>
      )
    }

    render(<TestCard title="Mi Card" />)

    expect(screen.getByRole('article', { name: /mi card/i })).toBeInTheDocument()
    expect(screen.getByText('Contenido de prueba')).toBeInTheDocument()
  })
})
