/** The HTML splash (#boot) is shown instantly by index.html. Keep it on screen for at least MIN_SPLASH_MS
 *  (same on web and Android) so the artwork is actually seen, then fade it out. */
const MIN_SPLASH_MS = 2000;
let hidden = false;
export function hideBoot() {
  if (hidden) return;
  hidden = true;
  const b = document.getElementById('boot');
  if (!b) return;
  const shownAt = Number(b.dataset.at || 0);
  const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - shownAt));
  setTimeout(() => b.classList.add('hide'), wait);
}
