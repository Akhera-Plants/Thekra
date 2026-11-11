/**
 * «تصدير بياناتي»: the account data as a FILE named thekra-export.json (owner round 8, item 7), never raw JSON text in
 * the share sheet. Native: written to the cache with expo-file-system and handed to the share sheet (expo-sharing), then
 * removed. Web build: a browser download of the same file. The file holds private data; the screen says so.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const EXPORT_FILE_NAME = 'thekra-export.json';

/** Returns false when this device cannot share files (nothing was written out). */
export async function shareExportFile(data: unknown, dialogTitle: string): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = EXPORT_FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, EXPORT_FILE_NAME);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
    return true;
  } finally {
    try {
      if (file.exists) file.delete();
    } catch {
      /* the cache is cleaned by the system anyway */
    }
  }
}
