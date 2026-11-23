// Análisis de archivos en el navegador: huella, texto, enlaces, miniatura y hash perceptual.
import { minhash, ytIds } from './match.js'

let pdfjsReady = null
export function pdfjs() {
  pdfjsReady ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return pdfjsReady
}

export const extOf = (name) => (String(name).match(/\.([a-z0-9]{1,5})$/i)?.[1] || '').toLowerCase()

const MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
}
export const mimeOf = (name) => MIME[extOf(name)] || 'application/octet-stream'

export function viewerOf(asset) {
  if (asset.kind === 'youtube') return 'youtube'
  if (asset.kind === 'link') return 'link'
  const m = asset.mime || ''
  if (m === 'application/pdf') return 'pdf'
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m === MIME.docx) return 'docx'
  return 'file'
}

export async function sha256(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** dHash de 64 bits. null si la imagen casi no tiene estructura (página en blanco con una línea). */
function dhash(source) {
  const c = document.createElement('canvas')
  c.width = 9
  c.height = 8
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 9, 8)
  ctx.drawImage(source, 0, 0, 9, 8)
  const d = ctx.getImageData(0, 0, 9, 8).data
  const g = (x, y) => {
    const i = (y * 9 + x) * 4
    return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
  }
  let bits = ''
  let ones = 0
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const b = g(x, y) > g(x + 1, y) + 2 ? 1 : 0
      ones += b
      bits += b
    }
  if (ones < 10 || ones > 54) return null
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

function thumbOf(source, w, h) {
  const scale = Math.min(1, 720 / w)
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(source, 0, 0, c.width, c.height)
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.82))
}

async function analyzePdf(bytes, out) {
  const lib = await pdfjs()
  const task = lib.getDocument({ data: bytes.slice() })
  const doc = await task.promise
  out.pages = doc.numPages
  let text = ''
  const links = []
  for (let n = 1; n <= Math.min(doc.numPages, 40); n++) {
    const page = await doc.getPage(n)
    const tc = await page.getTextContent()
    text += tc.items.map((i) => i.str).join(' ') + '\n'
    for (const a of await page.getAnnotations()) if (a.url) links.push(a.url)
  }
  const page = await doc.getPage(1)
  const vp = page.getViewport({ scale: 1 })
  const view = page.getViewport({ scale: 720 / vp.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(view.width)
  canvas.height = Math.round(view.height)
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: view }).promise
  out.thumb = await thumbOf(canvas, canvas.width, canvas.height)
  out.phash = dhash(canvas)
  out.text = text
  out.links = links
  await task.destroy()
}

async function analyzeImage(bytes, mime, out) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: mime }))
  out.thumb = await thumbOf(bmp, bmp.width, bmp.height)
  out.phash = dhash(bmp)
  bmp.close?.()
}

async function analyzeDocx(bytes, out) {
  const { unzipSync, strFromU8 } = await import('fflate')
  const z = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/_rels/document.xml.rels' })
  const xml = z['word/document.xml'] ? strFromU8(z['word/document.xml']) : ''
  out.text = xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ' ')
  const rels = z['word/_rels/document.xml.rels'] ? strFromU8(z['word/_rels/document.xml.rels']) : ''
  out.links = [...rels.matchAll(/Target="(https?:[^"]+)"/g)].map((m) => m[1])
}

/**
 * Analiza un archivo. Devuelve { sha, size, mime, ext, filename, pages, sig, phash, yt, thumb, chars }.
 * Si algo no se puede leer (PDF dañado, formato raro) se queda con la huella exacta, que siempre funciona.
 */
export async function analyze(filename, bytes) {
  const ext = extOf(filename)
  const mime = mimeOf(filename)
  const out = { filename, ext, mime, size: bytes.length, sha: await sha256(bytes), text: '', links: [], pages: null, thumb: null, phash: null }
  try {
    if (ext === 'pdf') await analyzePdf(bytes, out)
    else if (mime.startsWith('image/')) await analyzeImage(bytes, mime, out)
    else if (ext === 'docx') await analyzeDocx(bytes, out)
    else if (ext === 'txt') out.text = new TextDecoder().decode(bytes)
  } catch (e) {
    console.warn('No se pudo analizar', filename, e)
  }
  out.chars = out.text.trim().length
  out.sig = minhash(out.text)
  out.yt = ytIds(out.text + ' ' + out.links.join(' '))
  if (out.sig) out.phash = null
  delete out.text
  delete out.links
  return out
}
