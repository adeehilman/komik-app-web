/*
 * Koreksi bug WebKit (W-14, .agents/decisions.md D-11/D-12): di PWA iOS standalone dengan status bar
 * `black-translucent`, window.innerHeight kurang setinggi status bar. Selisihnya disimpan di --vh-gap
 * dan dipakai CSS untuk memanjangkan halaman & menurunkan elemen bawah ke tepi layar.
 * Di luar kondisi itu --vh-gap = 0px (tidak berefek).
 */
const MAX_GAP_PX = 100 // lebih besar dari ini = keyboard/kondisi lain, bukan bug status bar

function isAffected(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  return standalone && meta?.getAttribute('content') === 'black-translucent'
}

let lastGap = 0

function update() {
  let gap = 0
  if (isAffected()) {
    // Di iOS, screen.width/height tidak ikut berputar: height = sisi panjang saat portrait.
    const portrait = window.innerHeight >= window.innerWidth
    const fullHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    gap = Math.round(fullHeight - window.innerHeight)
    if (gap < 0 || gap > MAX_GAP_PX) gap = lastGap
  }
  lastGap = gap
  document.documentElement.style.setProperty('--vh-gap', `${gap}px`)
}

export function installViewportFix() {
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', () => window.setTimeout(update, 300))
}
