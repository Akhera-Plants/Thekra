export const PERMISSIONS: string[];
export const HOST_PERMISSIONS: string[];
export const GECKO_ID: string;
export function buildManifest(target: 'chrome' | 'firefox', version: string): Record<string, unknown>;
