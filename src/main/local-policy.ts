export function requireLoopback(base: string): string {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Undertone accepts only a local Ollama server (http://127.0.0.1:11434).');
  }
  return url.origin;
}
export function requireLocalModel(name: string): string {
  if (!name || name.length > 200 || /cloud|https?:|\//i.test(name)) throw new Error('Choose a local Ollama model. Cloud models are disabled.');
  return name;
}
