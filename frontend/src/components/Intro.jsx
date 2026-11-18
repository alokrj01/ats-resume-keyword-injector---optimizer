import { Icon } from './Ui'

function ResumeIllustration() {
  return (
    <figure className="hero-art" aria-label="A resume connected to a live ATS review">
      <svg className="desk-art" viewBox="0 0 500 332" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="desk-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#98beae" opacity=".65" />
          </pattern>
          <filter id="paper-shadow" x="-35%" y="-25%" width="180%" height="170%">
            <feDropShadow dx="2" dy="8" stdDeviation="6" floodColor="#194c3e" floodOpacity=".13" />
          </filter>
        </defs>
        <rect x="8" y="8" width="484" height="312" fill="url(#desk-dots)" />
        <g stroke="#86ada2" strokeWidth="1.4">
          <path d="M16 28V16h12m444 0h12v12M16 292v12h12m444 0h12v-12" />
        </g>
        <g transform="rotate(7 277 168)">
          <rect x="157" y="36" width="205" height="255" rx="6" fill="#a6d8c6" stroke="#41685b" strokeWidth="1.3" />
          <path d="M172 272h172" stroke="#709f8e" />
        </g>
        <g transform="rotate(-8 246 162)" filter="url(#paper-shadow)">
          <path d="M135 28h167l30 30v231a5 5 0 0 1-5 5H135a5 5 0 0 1-5-5V33a5 5 0 0 1 5-5Z" fill="#fffefa" stroke="#36554c" strokeWidth="1.5" />
          <path d="M302 28v25a5 5 0 0 0 5 5h25" fill="#d9ece4" stroke="#36554c" strokeWidth="1.2" />
          <rect x="148" y="48" width="34" height="9" rx="2" fill="#83d7ba" />
          <text x="148" y="94" className="art-head heading-3" fill="#203b33">Resume</text>
          <text x="149" y="116" className="caption-2" fill="#52675e">Your experience</text>
          <path d="M148 130h164" stroke="#c7d3ca" />
          <text x="148" y="152" className="art-caps caption-3" fill="#345149">Experience</text>
          <g fill="#c9d5cd">
            <rect x="148" y="165" width="142" height="6" rx="2" />
            <rect x="148" y="179" width="116" height="6" rx="2" />
            <rect x="148" y="204" width="150" height="5" rx="2" />
            <rect x="148" y="217" width="110" height="5" rx="2" />
          </g>
          <text x="148" y="251" className="art-caps caption-3" fill="#345149">Skills</text>
          <g fill="#dce8e0">
            <rect x="148" y="262" width="86" height="16" rx="8" />
            <rect x="241" y="262" width="69" height="16" rx="8" />
          </g>
        </g>
        <g transform="translate(381 63) rotate(10)">
          <path d="M0-38 8-29 19-33 22-21 33-19 30-8 39 0 30 8 33 19 21 22 19 33 8 30 0 38-8 30-19 33-22 21-33 19-30 8-39 0-30-8-33-19-21-22-19-33-8-29Z" fill="#fbaab6" stroke="#62414a" strokeWidth="1.6" />
          <path d="M0-16c1 11 5 14 15 16C5 2 1 5 0 16-2 5-5 2-15 0-5-2-2-5 0-16Z" fill="#3e3836" />
        </g>
        <g stroke="#2a594b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M88 178c-32 8-39 27-27 36 9 8 22-3 16-11-8-11-19 19 12 33 16 8 37 9 62 8" />
          <path d="m141 237 12 7-10 7" />
        </g>
        <g transform="rotate(3 333 248)" filter="url(#paper-shadow)">
          <rect x="194" y="217" width="257" height="68" rx="10" fill="#113f37" stroke="#10352f" strokeWidth="1.3" />
          <rect x="206" y="233" width="36" height="36" rx="8" fill="#b4f1d7" />
          <svg x="213" y="240" width="22" height="22" viewBox="0 0 256 256" fill="#183f35">
            <use href="/art/icons.svg#target" />
          </svg>
          <text x="252" y="242" className="art-caps caption-3" fill="#c5e6d7">Live ATS review</text>
          <text x="252" y="264" className="title-2" fill="white">See your role fit</text>
        </g>
      </svg>
      <figcaption className="art-caption caption-4">
        <span />Live score. Your decisions.
      </figcaption>
    </figure>
  )
}

export default function Intro() {
  return (
    <section className="hero" id="overview" aria-labelledby="hero-title" tabIndex={-1}>
      <div className="hero-copy">
        <div className="hero-tag kicker caption-3">
          <span className="studio-dot" />Resume tailoring studio
        </div>
        <h1 className="heading-1" id="hero-title">
          <span className="headline-ink">Your experience,</span>
          <span className="last-line">
            <span className="headline-ink">in the right words.</span>
            <svg viewBox="0 0 260 12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M3 9Q100 0 255 5" stroke="#64c9ad" strokeWidth="7" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="hero-sub body-3">Upload your real resume, compare it with a live job description, and use your backend’s ATS score to guide reviewable edits.</p>
        <div className="hero-actions">
          <a className="btn primary button-md" href="#workspace">
            Analyze my resume <Icon name="arrow-right" size={20} />
          </a>
          <span className="proof caption-1">
            <Icon name="check-circle" size={16} />You control every edit
          </span>
        </div>
      </div>
      <ResumeIllustration />
    </section>
  )
}