// Vite (Vitest) `?raw` imports: a test fixture as a string. Tests only; the build never imports these.
declare module '*?raw' {
  const text: string;
  export default text;
}
