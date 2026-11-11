/**
 * A «صحبة» invite code as it arrives in a link: 6 to 24 letters, digits or dashes (the API issues 10 characters of
 * 31 letters and digits). Anything else is not an invite, so the page is «غير موجودة» and nothing is echoed back.
 */
const INVITE_CODE = /^[A-Za-z0-9-]{6,24}$/;

export function readInviteCode(raw: string): string | null {
  let code: string;
  try {
    code = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  return INVITE_CODE.test(code) ? code.replace(/-/g, '').toUpperCase() : null;
}

/** `ABCDEFGHJK` → `ABCDE-FGHJK`, as the app shows it (easier to read aloud and to copy by hand). */
export function formatInviteCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

/** The app's own address for the invite (`mobile/app/circles/invite/[code].tsx`). */
export function inviteAppLink(code: string): string {
  return `thekra://circles/invite/${encodeURIComponent(code)}`;
}
