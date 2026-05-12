export function createGreeting(name: string): string {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return "Hello, world!";
  }

  return `Hello, ${trimmedName}!`;
}
