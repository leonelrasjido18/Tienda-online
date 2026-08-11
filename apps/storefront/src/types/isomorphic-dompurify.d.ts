declare module 'isomorphic-dompurify' {
  const DOMPurify: {
    sanitize(html: string, options?: Record<string, unknown>): string;
  };
  export default DOMPurify;
}
