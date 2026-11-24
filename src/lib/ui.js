// Piezas de interfaz compartidas por el taller.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export const pad = (n) => String(n).padStart(2, '0')
export const go = (path) => (location.hash = `#${path}`)

const I = (d, extra = '') =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`
export const icon = {
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  upload: I('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
  file: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  play: I('<path d="M8 5.5v13l11-6.5z"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  star: I('<path d="M12 4l2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.500-4-3.9 5.600-.8z"/>'),
  out: I('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10"/>'),
  dots: I('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
  trash: I('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  eye: I('<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>'),
}

/** Aviso breve abajo de la pantalla. */
export function toast(message, kind = 'ok') {
  let box = document.getElementById('toasts')
  if (!box) {
    box = document.createElement('div')
    box.id = 'toasts'
    box.setAttribute('aria-live', 'polite')
    document.body.appendChild(box)
  }
  const t = document.createElement('div')
  t.className = `toast is-${kind}`
  t.textContent = message
  box.appendChild(t)
  setTimeout(() => {
    t.classList.add('is-out')
    setTimeout(() => t.remove(), 300)
  }, kind === 'error' ? 6000 : 3200)
}

/** Ejecuta una acción con el botón bloqueado; los errores salen como aviso. */
export async function run(button, fn) {
  if (button?.disabled) return
  const label = button?.innerHTML
  if (button) {
    button.disabled = true
    button.classList.add('is-busy')
  }
  try {
    return await fn()
  } catch (e) {
    console.error(e)
    toast(e.message || 'Algo salió mal. Inténtalo de nuevo.', 'error')
  } finally {
    if (button && button.isConnected) {
      button.disabled = false
      button.classList.remove('is-busy')
      button.innerHTML = label
    }
  }
}

/**
 * Diálogo. `actions`: [{ label, value, kind }]. Devuelve el `value` elegido (o null si se cierra).
 * Si una acción trae `submit: true`, devuelve los campos del formulario como objeto.
 */
export function dialog({ title, body = '', actions = [{ label: 'Cerrar', value: null }], wide = false }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog')
    d.className = `dlg${wide ? ' is-wide' : ''}`
    d.innerHTML = `
      <form method="dialog" class="dlg-in">
        <header class="dlg-head"><h2 class="dlg-title">${esc(title)}</h2>
          <button type="button" class="ibtn" data-close aria-label="Cerrar">${icon.x}</button></header>
        <div class="dlg-body">${body}</div>
        <footer class="dlg-foot">${actions
          .map((a, i) => `<button type="${a.submit ? 'submit' : 'button'}" class="btn ${a.kind ? `btn-${a.kind}` : ''}" data-i="${i}">${esc(a.label)}</button>`)
          .join('')}</footer>
      </form>`
    document.body.appendChild(d)
    const form = d.querySelector('form')
    const done = (v) => {
      d.close()
      d.remove()
      resolve(v)
    }
    d.addEventListener('cancel', (e) => {
      e.preventDefault()
      done(null)
    })
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) return done(null)
      const b = e.target.closest('.dlg-foot [data-i]')
      if (b && b.type === 'button') done(actions[+b.dataset.i].value ?? null)
    })
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const a = actions[+e.submitter?.dataset.i]
      done({ ...Object.fromEntries(new FormData(form)), _action: a?.value })
    })
    d.showModal()
  })
}

export const confirmBox = (title, text, ok = 'Continuar', kind = 'primary') =>
  dialog({ title, body: `<p class="dlg-text">${esc(text)}</p>`, actions: [{ label: 'Cancelar', value: false }, { label: ok, value: true, kind }] })

export const field = (label, name, { type = 'text', value = '', hint = '', attrs = '' } = {}) => `
  <label class="field"><span class="field-label">${esc(label)}</span>
    ${type === 'textarea' ? `<textarea name="${name}" rows="3" ${attrs}>${esc(value)}</textarea>` : `<input type="${type}" name="${name}" value="${esc(value)}" ${attrs} />`}
    ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}</label>`

export const fmtSize = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1e3))} KB`)

export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    toast('Enlace copiado.')
  } catch {
    prompt('Copia el enlace:', text)
  }
}
