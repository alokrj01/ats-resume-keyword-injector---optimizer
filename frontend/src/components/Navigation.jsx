import { useEffect, useRef, useState } from 'react'
import { Icon, Wordmark } from './Ui'

const links = [
  ['overview', 'Overview'],
  ['guide', 'How it works'],
  ['faq', 'FAQ'],
]

export default function Navigation({ home }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('overview')

  const toggle = useRef(null)
  const menu = useRef(null)

  const linkTo = (id) => (home ? `#${id}` : `/#${id}`)

  useEffect(() => {
    if (!home) return undefined

    const ids = ['overview', 'workspace', 'guide', 'faq']

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    let frame = 0

    const update = () => {
      frame = 0

      const line = Math.max(148, window.innerHeight * 0.3)

      const current = elements
        .filter((element) => element.getBoundingClientRect().top <= line)
        .at(-1)

      const nextActive = current?.id || 'overview'

      setActive((previous) =>
        previous === nextActive ? previous : nextActive
      )
    }

    const scheduleUpdate = () => {
      if (!frame) {
        frame = requestAnimationFrame(update)
      }
    }

    window.addEventListener('scroll', scheduleUpdate, {
      passive: true,
    })

    window.addEventListener('resize', scheduleUpdate)

    // Initial calculation for direct links such as /#workspace.
    update()

    return () => {
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      cancelAnimationFrame(frame)
    }
  }, [home])

  useEffect(() => {
    if (!open) return undefined

    // Must match: @media (max-width: 760px) in index.css
    const mobile = window.matchMedia('(max-width: 760px)')

    // Covers a menu state that survives a resize into desktop layout.
    if (!mobile.matches) {
      const frame = requestAnimationFrame(() => setOpen(false))

      return () => cancelAnimationFrame(frame)
    }

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeWhenDesktop = (event) => {
      if (!event.matches) {
        setOpen(false)
      }
    }

    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
        return
      }

      if (event.key !== 'Tab') return

      const last = menu.current?.querySelector('a:last-child')

      if (event.shiftKey && document.activeElement === toggle.current) {
        event.preventDefault()
        last?.focus()
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        toggle.current?.focus()
      }
    }

    mobile.addEventListener('change', closeWhenDesktop)
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
      mobile.removeEventListener('change', closeWhenDesktop)
    }
  }, [open])

  const navigate = (id) => {
    setOpen(false)
    setActive(id)

    if (home) {
      requestAnimationFrame(() =>
        document.getElementById(id)?.focus({ preventScroll: true })
      )
    }
  }

  return (
    <header className={`nav-shell ${open ? 'menu-open' : ''}`}>
      <nav className="navbar" aria-label="Primary">
        <a
          href={linkTo('overview')}
          className="brand-link"
          aria-label="ATS Resume Optimizer home"
          onClick={() => navigate('overview')}
        >
          <Wordmark />
        </a>

        <div className="desktop-links">
          {links.map(([id, label]) => (
            <a
              key={id}
              className="nav-link title-4"
              href={linkTo(id)}
              aria-current={
                home && active === id ? 'location' : undefined
              }
              onClick={() => navigate(id)}
            >
              {label}
            </a>
          ))}
        </div>

        <a
          className="nav-action button-sm"
          href={linkTo('workspace')}
          aria-current={
            home && active === 'workspace' ? 'location' : undefined
          }
          onClick={() => navigate('workspace')}
        >
          Open workspace
          <Icon name="arrow-up-right" size={16} />
        </a>

        <button
          className="menu-toggle"
          ref={toggle}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mobile-links"
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
        </button>
      </nav>

      {open && (
        <div className="mobile-panel">
          <div className="mobile-links" id="mobile-links" ref={menu}>
            <span className="kicker caption-3">Navigation</span>

            {[
              links[0],
              ['workspace', 'Workspace'],
              ...links.slice(1),
            ].map(([id, label]) => (
              <a
                key={id}
                className="heading-4"
                href={linkTo(id)}
                onClick={() => navigate(id)}
                aria-current={
                  home && active === id ? 'location' : undefined
                }
              >
                {label}
                <Icon name="arrow-up-right" size={24} />
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}