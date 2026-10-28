/**
 * The two manifests. Permissions are the same for both and deliberately minimal (roadmap §5):
 * alarms, notifications, storage, and the Thekra API host only. No content scripts, no tabs/history access,
 * default CSP (no `content_security_policy` key).
 */
export const PERMISSIONS = ['alarms', 'notifications', 'storage'];
export const HOST_PERMISSIONS = ['https://thekra.vercel.app/*'];
/** Placeholder add-on id for AMO; replace before the first Firefox submission if another id is wanted. */
export const GECKO_ID = 'thekra@akhera-plants';

const ICONS = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };

/** @param {'chrome' | 'firefox'} target @param {string} version */
export function buildManifest(target, version) {
  const base = {
    manifest_version: 3,
    name: '__MSG_extName__',
    short_name: 'Thekra',
    description: '__MSG_extDescription__',
    version,
    default_locale: 'ar',
    icons: ICONS,
    action: { default_title: '__MSG_extName__', default_popup: 'popup.html', default_icon: ICONS },
    options_ui: { page: 'popup.html', open_in_tab: true },
    permissions: PERMISSIONS,
    host_permissions: HOST_PERMISSIONS,
  };
  if (target === 'chrome') {
    return { ...base, minimum_chrome_version: '114', background: { service_worker: 'background.js', type: 'module' } };
  }
  return {
    ...base,
    // Firefox MV3 runs background scripts as an event page (no service worker). The bundle has no import/export
    // statements, so it loads as a classic script on every supported Firefox version.
    background: { scripts: ['background.js'] },
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '121.0',
        // Required by AMO for new add-ons since 2025: the extension collects and transmits no user data.
        data_collection_permissions: { required: ['none'] },
      },
    },
  };
}
