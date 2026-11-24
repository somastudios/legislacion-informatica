// La baraja: una escena visible a la vez. Entre escenas, un cambio de profundidad:
// la que sale se aleja y se desenfoca; la que llega se acerca y se enfoca.
import gsap from 'gsap'

export function createDeck({ stage, scenes, reduced, onChange }) {
  const n = scenes.length
  const els = []
  const apis = []
  let index = -1
  let busy = false

  scenes.forEach((s) => {
    const el = document.createElement('section')
    el.className = `scene s-${s.id}`
    if (s.hue) el.style.setProperty('--hue', s.hue)
    el.setAttribute('aria-label', s.title)
    el.inert = true
    el.innerHTML = s.html()
    stage.appendChild(el)
    els.push(el)
  })

  const deck = {
    n,
    scenes,
    get index() {
      return index
    },
    get busy() {
      return busy
    },
    go,
    next,
    prev,
    resize: () => index >= 0 && apis[index].resize?.(),
    key: (e) => (index >= 0 && !busy ? apis[index].key?.(e) : false),
  }

  scenes.forEach((s, i) => apis.push(s.setup(els[i], { deck, reduced })))

  function show(i) {
    els[i].classList.add('is-on')
    els[i].inert = false
  }

  function hide(i) {
    els[i].classList.remove('is-on')
    els[i].inert = true
    gsap.set(els[i], { clearProps: 'opacity,visibility,transform,filter,zIndex' })
    apis[i].leave?.()
  }

  function go(i) {
    if (busy || i === index || i < 0 || i >= n) return false
    const from = index
    const dir = from < 0 || i > from ? 1 : -1
    const api = apis[i]
    index = i
    show(i)
    api.reset?.(dir)
    api.enter.progress(0).pause()
    onChange?.(i, from, dir)

    if (from < 0 || reduced) {
      if (from >= 0) hide(from)
      reduced ? api.enter.progress(1) : api.enter.play(0)
      return true
    }

    busy = true
    const out = els[from]
    const inn = els[i]
    gsap.set(inn, { zIndex: 2 })
    gsap.to(out, { autoAlpha: 0, scale: dir > 0 ? 0.94 : 1.06, filter: 'blur(16px)', duration: 0.5, ease: 'power2.in', onComplete: () => hide(from) })
    gsap.fromTo(
      inn,
      { autoAlpha: 0, scale: dir > 0 ? 1.07 : 0.93, filter: 'blur(16px)' },
      {
        autoAlpha: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 1,
        ease: 'expo.out',
        delay: 0.3,
        onComplete() {
          gsap.set(inn, { clearProps: 'transform,filter,zIndex' })
          busy = false
        },
      },
    )
    gsap.delayedCall(0.4, () => api.enter.play(0))
    return true
  }

  function next() {
    if (busy || index < 0) return
    if (apis[index].next?.()) return
    go(index + 1)
  }

  function prev() {
    if (busy || index < 0) return
    if (apis[index].prev?.()) return
    go(index - 1)
  }

  return deck
}
