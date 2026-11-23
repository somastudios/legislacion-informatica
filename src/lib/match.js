// Detección de trabajos iguales. Funciones puras: sirven en el navegador y en pruebas.
// Tres señales: mismo archivo (SHA-256), mismo video de YouTube y texto casi idéntico (MinHash).
// Para carteles escaneados, sin texto, se compara un hash perceptual de la imagen.

const YT = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/g

export const ytIds = (text) => [...new Set([...String(text || '').matchAll(YT)].map((m) => m[1]))]

export const plain = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const K = 64
const SEEDS = Array.from({ length: K }, (_, i) => Math.imul(i + 1, 0x9e3779b1))
export const SIG_MATCH = 0.5
export const PHASH_MATCH = 6

function fnv(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193)
  return h
}

/** Firma MinHash del texto (64 enteros). null si el texto es demasiado corto para comparar. */
export function minhash(text) {
  const w = plain(text).match(/[a-z0-9]+/g) || []
  if (w.length < 40) return null
  const mins = new Uint32Array(K).fill(0xffffffff)
  for (let i = 0; i + 5 <= w.length; i++) {
    const h = fnv(w.slice(i, i + 5).join(' '))
    for (let k = 0; k < K; k++) {
      let x = Math.imul((h + SEEDS[k]) | 0, 0x85ebca6b)
      x ^= x >>> 13
      x = Math.imul(x, 0xc2b2ae35)
      x = (x ^ (x >>> 16)) >>> 0
      if (x < mins[k]) mins[k] = x
    }
  }
  return Array.from(mins, (v) => v | 0)
}

export function sigSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let eq = 0
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) eq++
  return eq / a.length
}

export function hamming(a, b) {
  if (!a || !b) return 64
  let d = 0
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d
}

/** ¿Dos archivos son el mismo trabajo? Devuelve la razón o null. */
export function sameWork(a, b) {
  if (a.sha && a.sha === b.sha) return 'hash'
  if (a.yt?.length && b.yt?.length && a.yt.some((y) => b.yt.includes(y))) return 'youtube'
  if (a.sig && b.sig && sigSim(a.sig, b.sig) >= SIG_MATCH) return 'texto'
  if (!a.sig && !b.sig && a.phash && b.phash && hamming(a.phash, b.phash) <= PHASH_MATCH) return 'imagen'
  return null
}

/**
 * Agrupa entregas en equipos. Cada entrega: { person, sha, yt, sig, phash }.
 * Dos entregas quedan juntas si son el mismo trabajo o si son de la misma persona.
 */
export function cluster(items) {
  const parent = items.map((_, i) => i)
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]]
    return i
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (find(i) !== find(j) && ((items[i].person && items[i].person === items[j].person) || sameWork(items[i], items[j])))
        parent[find(i)] = find(j)
  const groups = new Map()
  items.forEach((it, i) => {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(it)
  })
  return [...groups.values()].sort((a, b) => b.length - a.length)
}

/** Empareja un nombre de carpeta de Moodle con la lista (el orden de nombres y apellidos no importa). */
export function matchPerson(name, people) {
  const tokens = (s) => new Set(plain(s).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean))
  const a = tokens(name)
  let best = null
  let score = 0
  for (const p of people) {
    const b = tokens(p.sort_name || p.full_name)
    let inter = 0
    for (const t of a) if (b.has(t)) inter++
    const s = inter / (a.size + b.size - inter || 1)
    if (s > score) {
      score = s
      best = p
    }
  }
  return score >= 0.6 ? best : null
}

/** Título legible a partir del nombre de archivo. */
export function titleFromFile(name) {
  const t = String(name || '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/\.docx$/i, '')
    .replace(/\(\d+\)/g, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s.\-–]+$/, '')
    .trim()
  if (!t || /^(whatsapp|camscanner|scan|img|image|video|link|url)\b/i.test(t)) return ''
  const cased = t.length > 4 && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t
  return cased.replace(/\b(ia|liia|unesco|mx)\b/gi, (m) => m.toUpperCase()).replace(/\s+compressed$/i, '')
}
