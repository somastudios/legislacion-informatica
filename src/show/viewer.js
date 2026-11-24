// Visor de piezas dentro de la presentación: PDF por páginas, imagen, video, YouTube y Word.
import { pdfjs, viewerOf } from '../lib/files.js'
import { signedUrls, urlOf } from '../lib/api.js'
import { C } from '../content/es.js'
import { pad } from '../core/fx.js'

export function createViewer(host) {
  let token = 0
  let pdf = null // { task, doc, page, pages, canvas, count, rendering }

  /** Dibuja la página pedida (`want`). Si piden otra mientras dibuja, la alcanza al terminar. */
  async function draw(force = false) {
    const cur = pdf
    if (!cur || cur.rendering || (!force && cur.shown === cur.want)) return
    cur.rendering = true
    const n = cur.want
    try {
      const page = await cur.doc.getPage(n)
      const box = cur.canvas.parentElement.getBoundingClientRect()
      const base = page.getViewport({ scale: 1 })
      const fit = Math.min(box.width / base.width, box.height / base.height)
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const view = page.getViewport({ scale: fit * dpr })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(view.width)
      canvas.height = Math.round(view.height)
      canvas.style.width = `${Math.round(view.width / dpr)}px`
      canvas.style.height = `${Math.round(view.height / dpr)}px`
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport: view }).promise
      if (pdf !== cur) return
      cur.canvas.replaceWith(canvas)
      cur.canvas = canvas
      cur.shown = n
      cur.count.textContent = `${pad(n)} / ${pad(cur.pages)}`
      host.classList.add('is-ready')
    } catch (e) {
      if (pdf === cur) console.warn('No se pudo dibujar la página', e)
    } finally {
      cur.rendering = false
      if (pdf === cur && cur.want !== cur.shown && cur.want !== n) draw()
    }
  }

  function turn(d) {
    if (!pdf) return false
    pdf.want = Math.max(1, Math.min(pdf.pages, pdf.want + d))
    draw()
    return true
  }

  function clear() {
    token++
    pdf?.task.destroy().catch(() => {})
    pdf = null
    host.classList.remove('is-ready')
    host.innerHTML = ''
  }

  async function show(asset) {
    clear()
    if (!asset) return
    const mine = token
    const kind = viewerOf(asset)
    host.dataset.kind = kind
    if (kind === 'youtube' && globalThis.__LIIA_DEMO__) {
      // Dentro de la demostración no se pueden incrustar videos: se enlaza.
      host.innerHTML = `<a class="mv-file" href="https://youtu.be/${encodeURIComponent(asset.yt_id)}" target="_blank" rel="noopener">Abrir el video en YouTube</a>`
      host.classList.add('is-ready')
      return
    }
    if (kind === 'youtube') {
      host.innerHTML = `<div class="mv-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(asset.yt_id)}?rel=0" title="Video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
      host.classList.add('is-ready')
      return
    }
    if (kind === 'link') {
      host.innerHTML = `<a class="mv-file" href="${asset.url}" target="_blank" rel="noopener">${C.work.open}</a>`
      host.classList.add('is-ready')
      return
    }
    await signedUrls([asset.storage_path])
    if (mine !== token) return
    const url = urlOf(asset.storage_path)
    if (!url) {
      host.innerHTML = `<p class="mv-note t-label">${C.work.missing}</p>`
      host.classList.add('is-ready')
      return
    }
    if (kind === 'image') {
      const img = new Image()
      img.className = 'mv-img'
      img.alt = ''
      img.onload = () => mine === token && host.classList.add('is-ready')
      img.src = url
      host.appendChild(img)
    } else if (kind === 'video') {
      host.innerHTML = `<video class="mv-video" controls playsinline preload="metadata" src="${url}"></video>`
      host.classList.add('is-ready')
    } else if (kind === 'pdf') {
      host.innerHTML = `<div class="mv-pdf"><canvas></canvas></div>
        <div class="mv-pages"><button type="button" data-pg="-1" aria-label="Página anterior">↑</button><span class="t-label" data-count></span><button type="button" data-pg="1" aria-label="Página siguiente">↓</button></div>`
      const lib = await pdfjs()
      const task = lib.getDocument({ url })
      const doc = await task.promise.catch(() => null)
      if (mine !== token || !doc) return task.destroy().catch(() => {})
      pdf = { task, doc, shown: 0, want: 1, pages: doc.numPages, canvas: host.querySelector('canvas'), count: host.querySelector('[data-count]'), rendering: false }
      host.querySelector('.mv-pages').hidden = doc.numPages < 2
      host.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => turn(+b.dataset.pg)))
      draw()
    } else if (kind === 'docx') {
      host.innerHTML = `<div class="mv-doc" data-scroll></div>`
      const [{ renderAsync }, blob] = await Promise.all([import('docx-preview'), fetch(url).then((r) => r.blob())])
      if (mine !== token) return
      await renderAsync(blob, host.firstElementChild, null, { inWrapper: false, ignoreWidth: true, ignoreHeight: true })
      if (mine === token) host.classList.add('is-ready')
    } else {
      host.innerHTML = `<a class="mv-file" href="${url}" target="_blank" rel="noopener">${C.work.open}</a>`
      host.classList.add('is-ready')
    }
  }

  return {
    show,
    clear,
    resize: () => draw(true),
    /** ↑ ↓ cambian de página cuando la pieza es un PDF. */
    key(e) {
      if (!pdf || pdf.pages < 2) return false
      if (e.key === 'ArrowDown') return turn(1)
      if (e.key === 'ArrowUp') return turn(-1)
      return false
    },
  }
}
