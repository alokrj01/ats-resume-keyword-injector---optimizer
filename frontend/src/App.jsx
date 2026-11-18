import { useEffect } from 'react'

import Navigation from './components/Navigation'
import Intro from './components/Intro'
import ResumeWorkspace from './components/ResumeWorkspace'
import { FAQ, FinalCta, Footer, Guide, InfoPage } from './components/SiteDetails'

const LEGACY_RESUME_STORAGE_KEYS = [
  'ats_saved_resume_base64',
  'ats_saved_resume_name',
]

function clearLegacyResumeStorage() {
  try {
    for (const key of LEGACY_RESUME_STORAGE_KEYS) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Storage access may be blocked by browser privacy settings.
  }
}

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  const home = pathname === '/' || pathname === '/index.html'

  useEffect(() => {
    clearLegacyResumeStorage()
  }, [])


  useEffect(() => {
    if (!home) return

    const fragment = window.location.hash.slice(1)

    if (fragment) {
      requestAnimationFrame(() =>
        document.getElementById(fragment)?.scrollIntoView({ behavior: 'instant' })
      )
    }
  }, [home])

  return (
    <>
      <a className="skip button-sm" href="#main-content">
        Skip to content
      </a>

      <Navigation home={home} />

      {home ? (
        <main id="main-content" className="layout" tabIndex={-1}>
          <Intro />
          <ResumeWorkspace />
          <Guide />
          <FAQ />
          <FinalCta />
        </main>
      ) : (
        <InfoPage path={pathname} />
      )}

      <div className="layout">
        <Footer />
      </div>
    </>
  )
}