declare module 'prismjs' {
  const Prism: {
    highlightAll: () => void
    [key: string]: any
  }
  export default Prism
}

declare module 'prismjs/*' {
  // Side-effect language/component modules (e.g. prismjs/components/prism-javascript)
  // Expose as any to satisfy TypeScript without strict type definitions.
  const lang: any
  export default lang
}
