/**
 * Theme bootstrap script.
 *
 * Kept in its own module on purpose: it is a plain string consumed by the root
 * layout (a server component), while the theme provider and toggle are client
 * components. Exporting a value from a client-component module into a server
 * component forces Fast Refresh to reload the whole page on edit.
 */

const STORAGE_KEY = "amih.theme.v1";

/**
 * Applies the stored theme before hydration so the first paint never flashes
 * the wrong colour scheme.
 */
export const themeInitScript = `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var p=(s==='light'||s==='dark'||s==='system')?s:'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export const THEME_STORAGE_KEY = STORAGE_KEY;
