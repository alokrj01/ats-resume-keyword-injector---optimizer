import { useEffect, useRef, useState } from 'react'
import { Icon } from './Ui'

export default function UploadForm({
  resumeFile,
  onFileChange,
  onRemove,
  fileInputRef,
  provider,
  setProvider,
  jdText,
  setJdText,
  onAnalyze,
  loading,
  busy,
  error,
  onClearError,
}) {
  const [dragging, setDragging] = useState(false)

  const dragDepth = useRef(0)
  const description = useRef(null)
  const picker = useRef(null)
  const focusPickerAfterRemove = useRef(false)

  useEffect(() => {
    if (resumeFile || !focusPickerAfterRemove.current) {
      return undefined
    }

    focusPickerAfterRemove.current = false

    const frame = requestAnimationFrame(() => {
      picker.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [resumeFile])

  function choose(file) {
    if (!busy && file) {
      onFileChange(file)
    }
  }

  function openFilePicker() {
    if (!busy) {
      fileInputRef.current?.click()
    }
  }

  function removeFile() {
    // The Remove button unmounts, so focus the picker after it renders.
    focusPickerAfterRemove.current = true
    onRemove()
  }

  function leave(event) {
    event.preventDefault()

    dragDepth.current = Math.max(0, dragDepth.current - 1)

    if (!dragDepth.current) {
      setDragging(false)
    }
  }

  return (
    <form
      className="panel input-panel"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onAnalyze()

        if (!resumeFile) {
          picker.current?.focus()
        } else if (!jdText.trim()) {
          description.current?.focus()
        }
      }}
      aria-label="Resume setup"
    >
      <div className="panel-head">
        <span className="tile yellow">
          <Icon name="files" size={24} />
        </span>

        <div>
          <h3 className="heading-6">Resume setup</h3>
          <p className="caption-2 muted">
            Use your real resume and target role
          </p>
        </div>
      </div>

      <div className="form-fields">
        <div className="field-block">
          <div className="field-label">
            <label id="file-label" htmlFor="resume-file" className="title-4">
              Base resume
            </label>

            <span className="micro-label caption-4">Required</span>
          </div>

          <input
            ref={fileInputRef}
            id="resume-file"
            tabIndex={-1}
            className="sr-only"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-labelledby="file-label"
            aria-describedby="file-hint"
            aria-invalid={error?.field === 'file' || undefined}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]

              event.target.value = ''
              choose(file)
            }}
          />

          <div
            className={`drop-area ${dragging ? 'dragging' : ''} ${resumeFile ? 'has-file' : ''
              }`}
            onDragOver={(event) => event.preventDefault()}
            onDragEnter={(event) => {
              event.preventDefault()

              if (!busy) {
                dragDepth.current += 1
                setDragging(true)
              }
            }}
            onDragLeave={leave}
            onDrop={(event) => {
              event.preventDefault()

              dragDepth.current = 0
              setDragging(false)

              choose(event.dataTransfer.files?.[0])
            }}
          >
            {resumeFile ? (
              <div className="chosen-file">
                <span className="file-icon">
                  <Icon name="file-doc" size={28} />
                </span>

                <div className="file-info">
                  <span className="title-3 file-name">
                    {resumeFile.name}
                  </span>

                  <span className="caption-2 muted" id="file-hint">
                    {resumeFile.size >= 1024 * 1024
                      ? `${(resumeFile.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.max(
                        1,
                        Math.round(resumeFile.size / 1024)
                      )} KB`}{' '}
                    · Word document
                  </span>
                </div>

                <button
                  type="button"
                  className="quiet-btn caption-4"
                  onClick={openFilePicker}
                  disabled={busy}
                >
                  <Icon name="arrows-clockwise" size={16} />
                  Replace file
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove resume"
                  title="Remove resume"
                  onClick={removeFile}
                  disabled={busy}
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            ) : (
              <button
                ref={picker}
                className="drop-target"
                type="button"
                disabled={busy}
                onClick={openFilePicker}
              >
                <span className="upload-icon">
                  <Icon name="cloud-arrow-up" size={28} />
                </span>

                <span className="title-3">
                  {dragging ? (
                    'Drop your resume here'
                  ) : (
                    <>
                      <span className="upload-link">Choose a file</span> or
                      drag it here
                    </>
                  )}
                </span>

                <span id="file-hint" className="caption-2 muted">
                  DOCX format · Up to 10 MB
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="field-block">
          <div className="field-label">
            <label htmlFor="jd-text" className="title-4">
              Target job description
            </label>

            {jdText ? (
              <button
                type="button"
                className="quiet-btn caption-4"
                onClick={() => {
                  setJdText('')
                  description.current?.focus()
                }}
                disabled={busy}
              >
                Clear
              </button>
            ) : (
              <span className="micro-label caption-4">Required</span>
            )}
          </div>

          <textarea
            className="body-6"
            ref={description}
            id="jd-text"
            rows={6}
            maxLength={30000}
            placeholder="Paste the responsibilities, requirements, and skills from the live job listing…"
            value={jdText}
            onChange={(event) => setJdText(event.target.value)}
            aria-invalid={error?.field === 'jd' || undefined}
            disabled={busy}
          />

          <div
            className="char-count caption-5"
            aria-label={`${jdText.length} of 30000 characters`}
          >
            {jdText.length.toLocaleString('en-US')} / 30,000
          </div>
        </div>

        <details className="provider-settings">
          <summary className="title-4">
            <Icon name="sliders-horizontal" size={18} />
            Analysis settings

            <span className="setting-value caption-2">
              {
                {
                  auto: 'Auto',
                  groq: 'Groq',
                  openrouter: 'OpenRouter',
                  gemini: 'Gemini',
                }[provider]
              }
            </span>

            <Icon name="caret-down" size={16} />
          </summary>

          <div className="settings-inner">
            <label htmlFor="provider" className="title-4">
              Cloud provider
            </label>

            <select
              id="provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              disabled={busy}
              className="body-6"
            >
              <option value="auto">Auto · Try available providers</option>
              <option value="groq">Groq</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Google Gemini</option>
            </select>

            <p className="caption-2 muted">
              Your backend extracts the resume text, compares it with this job
              description, and returns the ATS score and review data.
            </p>
          </div>
        </details>

        {error && (
          <div className="alert" id="form-error" role="alert">
            <Icon name="warning-circle" size={20} />

            <p className="body-6">{error.message}</p>

            <button
              type="button"
              className="icon-btn"
              aria-label="Dismiss setup message"
              onClick={onClearError}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        <button
          type="submit"
          className="btn primary analyze button-md"
          disabled={busy}
        >
          <Icon name="sparkle" />
          {loading ? 'Analyzing resume…' : 'Analyze resume'}
          <Icon className="push" name="arrow-right" size={18} />
        </button>
      </div>
    </form>
  )
}