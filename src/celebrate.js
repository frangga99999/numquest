import confetti from 'canvas-confetti'

const GOLD = ['#f4b942', '#ffd060', '#ffb300']

export function burst({ colors = GOLD, particleCount = 90, spread = 80 } = {}) {
  confetti({ particleCount, spread, origin: { y: 0.6 }, colors, scalar: 0.9, ticks: 160 })
}

export function bigWin() {
  const end = Date.now() + 600
  ;(function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: GOLD })
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: GOLD })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}
