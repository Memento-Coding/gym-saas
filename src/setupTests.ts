import '@testing-library/jest-dom'

// -----------------------------------------------------------------------------
// Polyfills para jsdom requeridos por componentes Radix UI (Select, Dialog…).
// jsdom no implementa estas APIs del navegador; los tests de componentes que
// usan shadcn/ui (basado en Radix) las necesitan.
// -----------------------------------------------------------------------------

// ResizeObserver — usado internamente por Radix para medir triggers/popovers.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// matchMedia — consultado por varios componentes responsivos.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  })) as unknown as typeof window.matchMedia
}

// scrollIntoView — Radix Select lo llama al abrir el listado.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}

// hasPointerCapture / setPointerCapture / releasePointerCapture — usados por
// Radix para gestión de foco con puntero.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
}
