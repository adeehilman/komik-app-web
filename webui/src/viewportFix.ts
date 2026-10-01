/*
 * Koreksi bug WebKit (W-14, .agents/decisions.md D-12): di PWA iOS standalone dengan status bar
 * `black-translucent`, kotak acuan `position: fixed` KADANG lebih pendek setinggi status bar (47pt di
 * iPhone 13 Pro), sehingga `bottom: 0` melayang di atas tepi layar. Bug ini tidak konsisten — dan
 * `innerHeight` bisa tetap "pendek" walau `fixed` sudah benar — jadi yang diukur adalah kotak `fixed`
 * itu sendiri (probe `top:0; bottom:0`), bukan `innerHeight`.
 *
 * --vh-gap     = tinggi layar − tinggi kotak fixed (0 bila tidak terkena bug / di luar PWA)
 * --app-height = tinggi kotak fixed + --vh-gap = tinggi layar penuh untuk html/body/#root
 */
const MAX_GAP_PX = 100 // lebih besar dari ini = keyboard/kondisi lain, bukan bug status bar

let probe: HTMLDivElement | null = null
let lastGap = 0

function isAffected(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  return standalone && meta?.getAttribute('content') === 'black-translucent'
}

/** Tinggi kotak acuan `position: fixed` yang sebenarnya dipakai browser saat ini. */
function fixedBoxHeight(): number {
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;top:0;bottom:0;left:0;width:0;visibility:hidden;pointer-events:none;'
    document.body.appendChild(probe)
  }
  return probe.getBoundingClientRect().height
}

function update() {
  const box = fixedBoxHeight()
  let gap = 0
  if (isAffected()) {
    // Di iOS, screen.width/height tidak ikut berputar: height = sisi panjang saat portrait.
    const portrait = window.innerHeight >= window.innerWidth
    const fullHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    gap = Math.round(fullHeight - box)
    if (gap < 0) gap = 0
    if (gap > MAX_GAP_PX) gap = lastGap
  }
  lastGap = gap
  const root = document.documentElement.style
  root.setProperty('--vh-gap', `${gap}px`)
  root.setProperty('--app-height', `${Math.round(box + gap)}px`)
}

/** Ukur ulang beberapa kali: iOS kadang mengubah ukuran viewport sesaat setelah app dibuka/dilanjutkan. */
function updateSoon() {
  update()
  window.setTimeout(update, 300)
  window.setTimeout(update, 1000)
}

export function installViewportFix() {
  updateSoon()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', updateSoon)
  window.addEventListener('pageshow', updateSoon)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateSoon()
  })
}
