/**
 * W-28: «13 و14 و15» drawn in a right-to-left line breaks apart around the «و» («13 و14و 15»). A run of three or more
 * consecutive numbers joined by «و» is written as a range instead: «من 13 إلى 15». Other text is unchanged.
 */
export function tidyArabicNumberRuns(text: string): string {
  return text.replace(/(\d+)((?:\s*و\s*\d+){2,})/g, (match, first: string, rest: string) => {
    const numbers = [Number(first), ...Array.from(rest.matchAll(/\d+/g), (m) => Number(m[0]))];
    const consecutive = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
    return consecutive ? `من ${numbers[0]} إلى ${numbers[numbers.length - 1]}` : match;
  });
}
