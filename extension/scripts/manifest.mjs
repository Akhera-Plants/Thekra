/**
 * The two manifests. Permissions are the same for both and deliberately minimal (roadmap §5):
 * alarms, notifications, storage, and the Thekra API host only (AlAdhan as an optional host, asked when a city is
 * saved). No content scripts, no tabs/history access, default CSP (no `content_security_policy` key).
 * Both browsers override the new-tab page (`chrome_url_overrides.newtab`, supported by Chrome and Firefox MV3). An
 * override cannot be switched off at runtime, so «صفحة التبويب الجديد» off in the options shows only the date.
 */
export const PERMISSIONS = ['alarms', 'notifications', 'storage'];
export const HOST_PERMISSIONS = ['https://thekra.vercel.app/*'];
/** Asked only when the user saves a city for prayer-time reminders (src/ext.ts PRAYER_ORIGINS). */
export const OPTIONAL_HOST_PERMISSIONS = ['https://api.aladhan.com/*'];
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
    optional_host_permissions: OPTIONAL_HOST_PERMISSIONS,
    chrome_url_overrides: { newtab: 'newtab.html' },
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
        // Required by AMO for new add-ons since 2025. Nothing is collected without an account; the optional sign-in
        // sends the email and password, then the tokens (Firefox 140+ asks for consent at sign-in: SIGN_IN_DATA in
        // src/popup/popup.ts; keep the two lists the same).
        data_collection_permissions: { required: ['none'], optional: ['authenticationInfo', 'personallyIdentifyingInfo'] },
      },
    },
  };
}
