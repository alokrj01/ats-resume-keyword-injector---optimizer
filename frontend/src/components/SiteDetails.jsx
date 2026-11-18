import { useEffect, useRef } from 'react'
import { Icon, Kicker, Wordmark } from './Ui'

const steps = [
  [
    '01',
    'cloud-arrow-up',
    'mint',
    'Start with your real documents',
    'Upload a Word resume and paste the target job description. Your original file is never overwritten.',
  ],
  [
    '02',
    'target',
    'yellow',
    'See the ATS score',
    'Your backend returns the role-fit score, matched skills, gaps, and only grounded phrase suggestions.',
  ],
  [
    '03',
    'arrow-line-down',
    'pink',
    'Choose what to take forward',
    'Turn edits on or off, adjust the wording, and download an editable Word document or PDF.',
  ],
]

const questions = [
  [
    'Which files can I upload?',
    'Use a Word document in DOCX format, up to 10 MB, with selectable text. PDF is an export format, not an upload format.',
  ],
  [
    'What does the ATS score mean?',
    'The backend compares the resume text with skills identified from the job description. When skill rules are available, it is a keyword-coverage percentage. Otherwise it uses the analysis estimate. It does not predict a hiring decision.',
  ],
  [
    'Does the score update when I change an edit?',
    'Yes. After you change a selected phrase, the frontend asks the backend’s deterministic scorer to recalculate the current selection. It does not make another cloud-AI request for that refresh.',
  ],
  [
    'Can I change a suggested edit?',
    'Yes. Edit the replacement in the review panel, or uncheck it to keep the original phrase. Only active edits are included when you download.',
  ],
  [
    'Where does my resume go?',
    'The server processes your DOCX and sends its extracted text and the job description to the selected AI provider for analysis. Review your deployment and provider policies before uploading sensitive information.',
  ],
  [
    'Will my original file change?',
    'No. Export creates a new file and leaves your original alone. The app edits text within the Word document to retain its styling. Longer wording can still change line wrapping.',
  ],
]

function Tagline() {
  const ref = useRef(null)
  const lines = ['Keep the experience.', 'Change the wording.']

  useEffect(() => {
    const element = ref.current
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const words = [...element.querySelectorAll('[data-word]')]
    let frame = 0
    let observed = false
    let finished = false

    const stop = () => {
      window.removeEventListener('scroll', tick)
      observed = false
    }

    const paint = () => {
      frame = 0

      const top = element.getBoundingClientRect().top
      const progress =
        (innerHeight * 0.91 - top) / Math.max(innerHeight * 0.28, 120)

      words.forEach((word, index) => {
        if (reduced.matches || progress >= (index + 1) / words.length) {
          word.classList.add('inked')
        }
      })

      if (progress >= 1 || reduced.matches) {
        finished = true
        stop()
      }
    }

    const tick = () => {
      if (!frame && !finished) {
        frame = requestAnimationFrame(paint)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || finished) {
        stop()
        return
      }

      if (!observed) {
        window.addEventListener('scroll', tick, { passive: true })
        observed = true
      }

      tick()
    })

    if (!reduced.matches) {
      element.classList.add('tagline-motion')
      observer.observe(element)
    }

    reduced.addEventListener('change', tick)

    return () => {
      stop()
      observer.disconnect()
      reduced.removeEventListener('change', tick)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <h2
      id="guide-title"
      ref={ref}
      className="tagline heading-2"
      aria-label={lines.join(' ')}
    >
      {lines.map((line) => (
        <span className="tagline-line" aria-hidden="true" key={line}>
          {line.split(' ').map((word, index) => (
            <span key={word}>
              {index > 0 && ' '}
              <span data-word>{word}</span>
            </span>
          ))}
        </span>
      ))}
    </h2>
  )
}

export function Guide() {
  return (
    <section
      className="guide below-section"
      id="guide"
      aria-labelledby="guide-title"
      tabIndex={-1}
    >
      <div className="guide-title">
        <Kicker mark>How it works</Kicker>
        <Tagline />
        <p className="body-3 muted">
          An applicant tracking system looks for familiar terms. Use language
          from the listing only where it reflects work you actually did.
        </p>
      </div>

      <ol className="step-list">
        {steps.map(([number, icon, color, title, detail]) => (
          <li key={number}>
            <span className={`tile ${color}`}>
              <Icon name={icon} size={24} />
            </span>

            <div>
              <span className="step-index caption-3">Step {number}</span>
              <h3 className="heading-6">{title}</h3>
              <p className="body-6 muted">{detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function FAQ() {
  return (
    <section
      id="faq"
      className="faq below-section"
      aria-labelledby="faq-title"
      tabIndex={-1}
    >
      <div>
        <Kicker mark>Field notes</Kicker>
        <h2 className="heading-3" id="faq-title">
          Good questions.
        </h2>
        <p className="body-3 muted">
          A few things to know before you upload.
        </p>
      </div>

      <div className="faq-list">
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary className="title-3">
              {question}
              <Icon name="plus" size={20} />
            </summary>
            <p className="body-3 muted">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="final-cta" aria-label="Start tailoring">
      <div>
        <Kicker mark>Next application</Kicker>
        <h2 className="heading-4">Make the words fit the role.</h2>
      </div>

      <a className="btn primary button-md" href="#workspace">
        Analyze my resume
        <Icon name="arrow-right" />
      </a>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <a href="/#overview" aria-label="ATS Resume Optimizer home">
        <Wordmark />
      </a>

      <nav aria-label="Footer" className="footlinks">
        <a className="body-5" href="/privacy">
          Privacy
        </a>
        <a className="body-5" href="/terms">
          Terms
        </a>
        <a className="body-5" href="/#faq">
          FAQ
        </a>
      </nav>
    </footer>
  )
}

const pages = {
  '/privacy': {
    label: 'Privacy',
    title: 'How your resume is handled',
    sections: [
      [
        'Document processing',
        'When you analyze a resume, the server processes your DOCX and sends extracted resume text and the job description to the configured cloud provider. Auto mode can try other configured providers if a request fails. Avoid including information you do not want to share with those providers.',
      ],
      [
        'Temporary files',
        'The server keeps a temporary copy so it can generate exports. On later analyses, it checks for temporary files older than one hour and removes them. Export files are scheduled for removal after the response. Downloads you keep on your device are yours to manage.',
      ],
      [
        'Browser memory',
        'The frontend keeps your selected DOCX in browser memory only while the page is open so it can request an export. It does not persist uploaded resume files in local browser storage. Refreshing or leaving the page clears that in-memory selection.',
      ],
      [
        'ATS score refresh',
        'After analysis, selected edits are sent with extracted resume text and job-skill rules to the server’s deterministic score endpoint. This recalculation does not contact a cloud AI provider.',
      ],
    ],
  },
  '/terms': {
    label: 'Terms',
    title: 'Using the optimizer',
    sections: [
      [
        'Your documents',
        'Upload only material you have permission to process. Keep your original file, and verify the facts and wording of any resume you choose to send.',
      ],
      [
        'Suggestions and scores',
        'Suggested edits are optional. Match percentages are estimates based on selected job skills or, when necessary, a model estimate. They do not represent an employer’s score or guarantee an interview.',
      ],
      [
        'Downloads and providers',
        'Word and PDF exports may wrap differently from the original. Check the finished document before applying. Live analysis depends on the availability and configuration of the chosen provider.',
      ],
    ],
  },
}

export function InfoPage({ path }) {
  const page = pages[path]

  useEffect(() => {
    document.title = `${page?.label || 'Page not found'} | ATS Resume Optimizer`
  }, [page])

  return (
    <main
      id="main-content"
      className="info-page layout"
      tabIndex={-1}
    >
      <a className="text-link button-sm" href="/">
        <Icon name="arrow-left" size={16} />
        Back to the studio
      </a>

      <article>
        <Kicker mark>{page?.label || '404 / Page not found'}</Kicker>

        <h1 className="heading-2">
          {page?.title || 'This page isn’t in the file.'}
        </h1>

        {page ? (
          page.sections.map(([heading, paragraph]) => (
            <section key={heading}>
              <h2 className="heading-6">{heading}</h2>
              <p className="body-3 muted">{paragraph}</p>
            </section>
          ))
        ) : (
          <>
            <p className="body-3 muted">
              The address may have changed. Your workspace is still one click
              away.
            </p>

            <a className="btn primary button-md" href="/#workspace">
              Open workspace
              <Icon name="arrow-right" />
            </a>
          </>
        )}
      </article>
    </main>
  )
}