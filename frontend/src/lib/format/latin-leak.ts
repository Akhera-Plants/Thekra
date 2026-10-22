/** Latin words left after the language switch is removed. The switch label is the only allowed Latin. */
export function latinLeaks(text: string): string[] {
  const lines = text.split(/\n/);
  const leaks: string[] = [];
  for (const line of lines) {
    if (line.trim() === 'English') continue;
    const words = line.match(/[A-Za-z]+/g);
    if (words) leaks.push(...words);
  }
  return leaks;
}
