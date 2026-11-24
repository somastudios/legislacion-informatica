// Marco del taller y piezas que comparten sus pantallas.
import { MAX_FILE_MB } from '../lib/config.js'
import { analyze } from '../lib/files.js'
import { titleFromFile, ytIds } from '../lib/match.js'
import { loadGen, me, pickGen, rpc, sb, shortName, signOut, signedUrls, storePiece, urlOf, workOf, youtubePiece } from '../lib/api.js'
import { dialog, esc, go, icon, toast } from '../lib/ui.js'
import { glyph, glyphFor } from '../icons/glyphs.js'

const MARK = `<span class="mk" aria-hidden="true">${glyph('section', { width: 11, amp: 0.4 })}<i></i></span>`

/** Barra superior + contenedor. Devuelve el <main> donde pinta cada pantalla. */
export function frame(root, active = '') {
  const tab = (href, label, key) => `<a href="#${href}" class="${active === key ? 'is-on' : ''}">${label}</a>`
  root.innerHTML = `
    <div class="app">
      <header class="top">
        <a class="brand" href="#/">${MARK}<span><b>LIIA</b> Compendio</span></a>
        <nav class="top-nav">
          ${tab('/', me.person?.role === 'teacher' ? 'Actividades' : 'Mis trabajos', 'home')}
          ${me.isAdmin ? tab('/admin', 'Administración', 'admin') : ''}
        </nav>
        <div class="top-right">
          ${me.gens.length > 1 ? `<select class="gen-pick" data-gen aria-label="Generación">${me.gens.map((g) => `<option value="${g.id}" ${g.id === me.gen?.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>` : `<span class="t-label gen-name">${esc(me.gen?.name || '')}</span>`}
          <a class="btn btn-ink btn-sm" href="#/ver">Presentación ${icon.play}</a>
          <button type="button" class="ibtn" data-out title="Cerrar sesión" aria-label="Cerrar sesión">${icon.out}</button>
        </div>
      </header>
      <main class="main" data-main></main>
    </div>`
  root.querySelector('[data-out]').addEventListener('click', async () => {
    await signOut()
    go('/entrar')
  })
  root.querySelector('[data-gen]')?.addEventListener('change', (e) => {
    pickGen(e.target.value)
    location.hash === '#/' ? dispatchEvent(new HashChangeEvent('hashchange')) : go('/')
  })
  return root.querySelector('[data-main]')
}

export const names = (work, max = 6) => {
  const n = work.members.map((m) => shortName(m.person))
  return n.length > max ? `${n.slice(0, max).join(', ')} y ${n.length - max} más` : n.join(', ')
}

/** Miniatura de una pieza. */
export function thumb(asset, cls = '', activity = null) {
  if (!asset) return `<span class="thumb is-empty ${cls}">${activity ? glyph(glyphFor(activity), { width: 6 }) : icon.file}</span>`
  if (asset.kind === 'youtube')
    return `<span class="thumb is-video ${cls}"><img src="https://i.ytimg.com/vi/${esc(asset.yt_id)}/hqdefault.jpg" alt="" loading="lazy" /><i>${icon.play}</i></span>`
  const src = urlOf(asset.thumb_path)
  if (src) return `<span class="thumb ${cls}"><img src="${esc(src)}" alt="" loading="lazy" /></span>`
  const ext = (asset.filename || '').split('.').pop()
  return `<span class="thumb is-empty ${cls}">${(asset.mime || '').startsWith('video/') ? icon.play : icon.file}<b>${esc(ext.slice(0, 4))}</b></span>`
}

export const cover = (work) => work.assets.find((a) => a.kind === 'youtube' || a.thumb_path) || work.assets[0]

export async function withThumbs(data) {
  await signedUrls([...data.works.values()].flatMap((w) => w.assets.map((a) => a.thumb_path)))
  return data
}

export const pieceLabel = (a) => a.label || (a.kind === 'youtube' ? 'Video en YouTube' : a.kind === 'link' ? a.url : a.filename) || 'Pieza'

export async function openAsset(asset) {
  if (asset.kind !== 'file') return window.open(asset.url, '_blank', 'noopener')
  const tab = window.open('', '_blank')
  await signedUrls([asset.storage_path])
  if (tab) tab.location = urlOf(asset.storage_path)
}

// ── Subir: primero se compara, luego se guarda ──

async function resolve(act, matches, target) {
  if (!matches.length) return 'new'
  const data = await loadGen()
  const best = [...matches].sort((a, b) => b.score - a.score)[0]
  const exact = best.reason === 'hash' || best.reason === 'youtube'
  const mine = target || workOf(data.activities.find((a) => a.id === act.id), me.person?.id)?.id
  if (best.work_id === mine) {
    if (exact) {
      toast('Esa pieza ya está en este trabajo.')
      return 'already'
    }
    return 'new'
  }
  const other = data.works.get(best.work_id)
  const who = other ? `«${other.title}» de ${names(other) || 'un equipo sin integrantes'}` : 'otro trabajo'
  if (target) {
    if (!exact) return 'new'
    await dialog({ title: 'Esa pieza ya existe', body: `<p class="dlg-text">Ya está en ${esc(who)}. No se duplicó.</p>` })
    return 'cancel'
  }
  const why = { hash: 'Es exactamente el mismo archivo.', youtube: 'Es el mismo video.', texto: `El texto coincide en ${Math.round(best.score * 100)} %.`, imagen: 'La imagen es casi idéntica.' }[best.reason]
  const pick = await dialog({
    title: exact ? 'Tu equipo ya lo subió' : '¿Es el mismo trabajo?',
    body: `<p class="dlg-text">${esc(why)} Ya está en ${esc(who)}.</p>
      <p class="dlg-text">${mine ? 'Si te unes, sales del trabajo que tenías en esta actividad.' : 'Únete y quedas en ese equipo, sin subir nada dos veces.'}</p>`,
    actions: exact
      ? [{ label: 'Cancelar', value: 'cancel' }, { label: 'Unirme a ese equipo', value: 'join', kind: 'primary' }]
      : [{ label: 'Es otro trabajo: subirlo aparte', value: 'new' }, { label: 'Es el mismo: unirme', value: 'join', kind: 'primary' }],
  })
  if (pick === 'join') {
    await rpc('join_work', { p_work: best.work_id })
    toast('Listo, ya estás en ese equipo.')
    return 'joined'
  }
  return pick || 'cancel'
}

const find = async (act, { sha = null, yt = null, sig = null, phash = null }) => {
  const { data, error } = await sb.rpc('find_matches', { p_activity: act.id, p_sha: sha, p_yt: yt, p_sig: sig, p_phash: phash })
  if (error) throw new Error(error.message)
  return data
}

export async function submitYoutube(act, id, { work = null } = {}) {
  const r = await resolve(act, await find(act, { yt: id }), work)
  if (r !== 'new') return r
  await rpc('add_piece', { p_activity: act.id, p_piece: { ...youtubePiece(id), title: 'Video' }, p_work: work })
  toast('Video agregado.')
  return 'added'
}

export async function submitLink(act, text, opts) {
  const id = ytIds(text)[0]
  if (!id) throw new Error('Ese enlace no parece de YouTube. Pega el enlace completo del video.')
  return submitYoutube(act, id, opts)
}

export async function submitFile(act, file, { work = null, status = () => {} } = {}) {
  if (file.size > MAX_FILE_MB * 1e6) throw new Error(`El archivo pesa más de ${MAX_FILE_MB} MB. Si es un video, súbelo a YouTube y pega el enlace.`)
  status('Leyendo el archivo…')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const info = await analyze(file.name, bytes)
  // Un PDF o txt que solo trae el enlace del video cuenta como el video.
  if (info.yt.length && info.chars < 400) return submitYoutube(act, info.yt[0], { work })
  status('Comparando con lo que ya hay…')
  const r = await resolve(act, await find(act, { sha: info.sha, sig: info.sig, phash: info.phash, yt: info.yt[0] || null }), work)
  if (r !== 'new') return r
  status('Subiendo…')
  const piece = await storePiece(me.gen.id, info, bytes)
  await rpc('add_piece', { p_activity: act.id, p_piece: { ...piece, title: titleFromFile(file.name) }, p_work: work })
  toast('Archivo agregado.')
  return 'added'
}

/** Zona para soltar archivos o pegar un enlace. `onDone` se llama cuando algo cambió. */
export function dropzone(el, act, { work = null, onDone, compact = false } = {}) {
  el.innerHTML = `
    <div class="drop ${compact ? 'is-compact' : ''}" data-drop>
      <input type="file" hidden data-file accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.mp4,.webm,.mov,.txt" />
      <button type="button" class="drop-main" data-pick>
        <span class="drop-ic">${icon.upload}</span>
        <span class="drop-t">${compact ? 'Agregar otra pieza' : 'Suelta tu archivo aquí'}</span>
        <span class="drop-s" data-status>${compact ? 'PDF, imagen, Word o video' : 'o haz clic para elegirlo · PDF, imagen, Word o video'}</span>
      </button>
      <form class="drop-link" data-link>
        <input type="url" name="url" placeholder="o pega el enlace de YouTube" aria-label="Enlace de YouTube" />
        <button class="btn btn-sm" type="submit">Agregar</button>
      </form>
    </div>`
  const drop = el.querySelector('[data-drop]')
  const input = el.querySelector('[data-file]')
  const status = el.querySelector('[data-status]')
  const idle = status.textContent
  const work_ = async (fn) => {
    if (drop.classList.contains('is-busy')) return
    drop.classList.add('is-busy')
    try {
      const r = await fn()
      if (r === 'added' || r === 'joined') await onDone?.()
    } catch (e) {
      console.error(e)
      toast(e.message || 'No se pudo subir.', 'error')
    } finally {
      drop.classList.remove('is-busy')
      if (status.isConnected) status.textContent = idle
    }
  }
  const take = (file) => file && work_(() => submitFile(act, file, { work, status: (t) => (status.textContent = t) }))
  el.querySelector('[data-pick]').addEventListener('click', () => input.click())
  input.addEventListener('change', () => {
    take(input.files[0])
    input.value = ''
  })
  for (const ev of ['dragenter', 'dragover'])
    drop.addEventListener(ev, (e) => {
      e.preventDefault()
      drop.classList.add('is-over')
    })
  for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, () => drop.classList.remove('is-over'))
  drop.addEventListener('drop', (e) => {
    e.preventDefault()
    take(e.dataTransfer.files[0])
  })
  el.querySelector('[data-link]').addEventListener('submit', (e) => {
    e.preventDefault()
    const url = e.target.elements.url.value.trim()
    if (url) work_(() => submitLink(act, url, { work })).then(() => e.target.reset())
  })
}
