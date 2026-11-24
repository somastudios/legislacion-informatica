import { boil, P } from '../core/boil.js'

// Dibujos a mano del compendio: el signo de sección (la marca) y un icono por tipo de entrega.
// Todos se trazan sobre una retícula de 100 × 100 y se dibujan animando --draw de 1.06 a 0.

const pts = (list, closed = false) => ({ pts: list, closed })
const box = (x1, y1, x2, y2) => [P.line(x1, y1, x2, y1), P.line(x2, y1, x2, y2), P.line(x2, y2, x1, y2), P.line(x1, y2, x1, y1)]

// § : dos trazos gemelos, uno girado media vuelta sobre el otro.
const HALF = [
  [30, -58],
  [14, -78],
  [-12, -78],
  [-28, -58],
  [-20, -36],
  [4, -20],
  [28, -2],
  [36, 22],
  [22, 40],
  [2, 46],
]
const at = (s, k = 0.52) => pts(s.map(([x, y]) => [50 + x * k, 50 + y * k]))

const SHAPES = {
  section: [at(HALF), at(HALF.map(([x, y]) => [-x, -y]))],
  doc: [
    pts([
      [24, 10],
      [60, 10],
      [78, 28],
      [78, 90],
      [24, 90],
      [24, 10],
    ]),
    P.line(60, 10, 60, 28),
    P.line(60, 28, 78, 28),
    P.line(35, 46, 67, 46),
    P.line(35, 60, 67, 60),
    P.line(35, 74, 55, 74),
  ],
  cartel: [...box(22, 10, 78, 70), P.circle(50, 32, 10, 12), P.line(34, 56, 66, 56), P.line(40, 70, 30, 92), P.line(60, 70, 70, 92)],
  video: [
    ...box(12, 24, 88, 76),
    pts(
      [
        [42, 37],
        [63, 50],
        [42, 63],
      ],
      true,
    ),
  ],
  lupa: [P.circle(43, 43, 26, 22), P.line(62, 62, 88, 88), P.arc(43, 43, 15, 200, 280)],
  balanza: [
    P.line(50, 12, 50, 84),
    P.line(32, 86, 68, 86),
    P.line(18, 24, 82, 24),
    P.line(18, 24, 8, 52),
    P.line(18, 24, 28, 52),
    P.arc(18, 52, 10, 0, 180),
    P.line(82, 24, 72, 52),
    P.line(82, 24, 92, 52),
    P.arc(82, 52, 10, 0, 180),
  ],
}

/** SVG listo para insertar. `width` es el grosor del trazo en unidades de la retícula. */
export function glyph(name, { cls = '', width = 5, amp = 0.7 } = {}) {
  return `<svg class="glyph ${cls}" viewBox="0 0 100 100" aria-hidden="true">${boil(SHAPES[name] || SHAPES.doc, { amp, cls: 'draw', attrs: `stroke-width="${width}"` })}</svg>`
}

/** El icono que le toca a una actividad según su tipo y su etiqueta. */
export function glyphFor(activity) {
  const label = (activity.label || '').toLowerCase()
  if (/regul|ley|norma/.test(label)) return 'balanza'
  if (/an[aá]lisis|recomend/.test(label)) return 'lupa'
  return { cartel: 'cartel', video: 'video' }[activity.kind] || 'doc'
}
