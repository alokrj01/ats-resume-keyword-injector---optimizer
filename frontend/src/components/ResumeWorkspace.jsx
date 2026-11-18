import { useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeResumeApi,
  generateDocxApi,
  generatePdfApi,
  scoreResumeApi,
} from '../api/resumeApi'
import UploadForm from './UploadForm'
import SwapPreviewList from './SwapPreviewList'
import { Icon, Kicker } from './Ui'

const MAX_BYTES = 10 * 1024 * 1024

function fileSegment(value, fallback) {
  const printable = Array.from(String(value || ''))
    .filter(char => char.charCodeAt(0) >= 32)
    .join('')

  return printable
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100) || fallback
}

function explainError(message, fallback) {
  if (/no cloud AI API key|no API key configured/i.test(message)) {
    return 'Live analysis needs a configured provider on this server. Ask the site operator to configure an AI provider, then try again.'
  }

  if (/failed to fetch|networkerror/i.test(message)) {
    return 'The document service could not be reached. Check that the backend is running and try again.'
  }

  return message || fallback
}

function approvedReplacementMap(swaps) {
  return Object.fromEntries(
    swaps
      .filter(
        swap =>
          swap.approved &&
          swap.replacement.replace(/\*\*/g, '').trim()
      )
      .map(swap => [swap.original, swap.replacement]),
  )
}

function selectionKeyFor(approvedMap) {
  return JSON.stringify(
    Object.entries(approvedMap).sort(
      ([leftOriginal, leftReplacement], [rightOriginal, rightReplacement]) =>
        leftOriginal.localeCompare(rightOriginal) ||
        leftReplacement.localeCompare(rightReplacement),
    ),
  )
}

function initialScoreFromAnalysis(data) {
  return {
    before: data.ats_score_before,
    current: data.ats_score_estimated,
    matched: data.matched_skills || [],
    gained: [],
    missing: data.missing_skills || [],
    mode: data.jd_skills?.length ? 'keyword_coverage' : 'model_estimate',
  }
}

function focusReview() {
  requestAnimationFrame(() => {
    const panel = document.getElementById('review')

    panel?.focus({ preventScroll: true })

    if (matchMedia('(max-width: 839px)').matches) {
      panel?.scrollIntoView({ block: 'start' })
    }
  })
}

export default function ResumeWorkspace() {
  const [file, setFile] = useState(null)
  const [jd, setJd] = useState('')
  const [provider, setProvider] = useState('auto')
  const [result, setResult] = useState(null)
  const [swaps, setSwaps] = useState([])
  const [score, setScore] = useState(null)
  const [scoreSelectionKey, setScoreSelectionKey] = useState(null)
  const [scoreRefreshing, setScoreRefreshing] = useState(false)
  const [scoreError, setScoreError] = useState('')
  const [scoreRequest, setScoreRequest] = useState(0)
  const [loading, setLoading] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState(null)
  const [downloaded, setDownloaded] = useState('')
  const [error, setError] = useState(null)
  const [exportError, setExportError] = useState('')

  const input = useRef(null)
  const downloadController = useRef(null)

  const busy = loading || Boolean(downloadFormat)

  const approvedMap = useMemo(
    () => approvedReplacementMap(swaps),
    [swaps],
  )

  const selectionKey = useMemo(
    () => selectionKeyFor(approvedMap),
    [approvedMap],
  )

  const scoreMatchesSelection = Boolean(
    score && scoreSelectionKey === selectionKey,
  )

  useEffect(() => {
    if (!result) return undefined

    const controller = new AbortController()
    const requestSelectionKey = selectionKey

    const timer = window.setTimeout(async () => {
      setScoreRefreshing(true)
      setScoreError('')

      try {
        const data = await scoreResumeApi({
          baseResumeText: result.text,
          jdSkills: result.skills,
          approvedMap,
          fallbackBefore: result.before,
          fallbackEstimated: result.estimated,
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        setScore({
          before: data.ats_score_before,
          current: data.ats_score_current,
          matched: data.matched_skills || [],
          gained: data.gained_skills || [],
          missing: data.missing_skills || [],
          mode: data.scoring_mode,
        })

        setScoreSelectionKey(requestSelectionKey)
      } catch (requestError) {
        if (
          requestError?.name === 'AbortError' ||
          controller.signal.aborted
        ) {
          return
        }

        setScoreError(
          'The score for your current selection could not be refreshed. The values below are from the last successful selection.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setScoreRefreshing(false)
        }
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [approvedMap, result, scoreRequest, selectionKey])

  useEffect(() => {
    return () => downloadController.current?.abort()
  }, [])

  function clearReview() {
    setResult(null)
    setSwaps([])
    setScore(null)
    setScoreSelectionKey(null)
    setScoreError('')
    setScoreRefreshing(false)
    setDownloaded('')
    setExportError('')
  }

  function chooseFile(next) {
    if (!next) return

    if (!next.name.toLowerCase().endsWith('.docx')) {
      setError({
        field: 'file',
        message:
          'Choose a Word document ending in .docx. PDFs can be downloaded after review, but cannot be uploaded.',
      })
      return
    }

    if (!next.size || next.size > MAX_BYTES) {
      setError({
        field: 'file',
        message: next.size
          ? 'This file is too large. Choose a DOCX no larger than 10 MB.'
          : 'This file is empty. Choose a DOCX that contains your resume.',
      })
      return
    }

    clearReview()
    setError(null)
    setFile(next)
  }

  function remove() {
    setFile(null)
    clearReview()
    setError(null)

    if (input.current) {
      input.current.value = ''
    }
  }

  function updateDescription(value) {
    setJd(value)

    if (error?.field === 'jd') {
      setError(null)
    }

    if (result) {
      clearReview()
    }
  }

  function updateProvider(value) {
    setProvider(value)

    if (result) {
      clearReview()
    }
  }

  async function analyze() {
    if (busy) return

    if (!file) {
      setError({
        field: 'file',
        message: 'Add your base resume as a DOCX file to start.',
      })
      return
    }

    if (!jd.trim() || jd.trim().length > 30000) {
      setError({
        field: 'jd',
        message: 'Paste a job description of up to 30,000 characters.',
      })
      return
    }

    setError(null)
    setExportError('')
    setDownloaded('')
    setLoading(true)

    try {
      const data = await analyzeResumeApi(file, jd.trim(), provider)

      const nextResult = {
        source: file,
        sourceName: file.name,
        session: data.session_id,
        title: data.job_title,
        company: data.company_name,
        modelUsed: data.model_used,
        text: data.base_resume_text || '',
        skills: data.jd_skills || [],
        before: data.ats_score_before,
        estimated: data.ats_score_estimated,
        matched: data.matched_skills || [],
        missing: data.missing_skills || [],
      }

      const nextSwaps = (data.swaps || []).map((swap, id) => ({
        ...swap,
        id,
        approved: true,
      }))

      const nextSelectionKey = selectionKeyFor(
        approvedReplacementMap(nextSwaps),
      )

      setResult(nextResult)
      setSwaps(nextSwaps)
      setScore(initialScoreFromAnalysis(data))
      setScoreSelectionKey(nextSelectionKey)
      setScoreError('')
      focusReview()
    } catch (requestError) {
      setError({
        field: 'service',
        message: explainError(
          requestError.message,
          'Analysis failed. Check the file and try again.',
        ),
      })
    } finally {
      setLoading(false)
    }
  }

  function changeSwap(id, update) {
    setDownloaded('')
    setExportError('')
    setScoreError('')
    setScoreRefreshing(true)

    setSwaps(list =>
      list.map(swap =>
        swap.id === id ? { ...swap, ...update(swap) } : swap,
      ),
    )
  }

  function retryScore() {
    if (!result) return

    setScoreError('')
    setScoreRefreshing(true)
    setScoreRequest(value => value + 1)
  }

  function cancelDownload() {
    downloadController.current?.abort()
  }

  async function download(format) {
    if (!result || busy) return

    const controller = new AbortController()

    downloadController.current = controller
    setDownloadFormat(format)
    setExportError('')
    setDownloaded('')

    try {
      const request = format === 'docx' ? generateDocxApi : generatePdfApi

      const blob = await request({
        resumeFile: result.source,
        sessionId: result.session,
        approvedMap,
        signal: controller.signal,
      })

      if (controller.signal.aborted) {
        setExportError(
          `${format.toUpperCase()} download was cancelled. Your approved edits are still available to export.`,
        )
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download =
        [
          fileSegment(result.sourceName?.replace(/\.docx$/i, ''), 'Resume'),
          fileSegment(result.title, 'Role'),
          fileSegment(result.company, 'Company'),
        ].join('_') + `.${format}`

      document.body.append(link)
      link.click()
      link.remove()

      window.setTimeout(() => URL.revokeObjectURL(url), 2000)

      setDownloaded(
        `${format.toUpperCase()} is ready. Your download has started.`,
      )
    } catch (requestError) {
      if (controller.signal.aborted || requestError?.name === 'AbortError') {
        setExportError(
          `${format.toUpperCase()} download was cancelled. Your approved edits are still available to export.`,
        )
      } else {
        setExportError(
          explainError(
            requestError.message,
            `Could not generate the ${format.toUpperCase()}. Please try again.`,
          ),
        )
      }
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null
        setDownloadFormat(null)
      }
    }
  }

  const stage = downloadFormat || downloaded ? 3 : result ? 2 : 1

  return (
    <section
      id="workspace"
      className="workspace"
      aria-labelledby="workspace-title"
      tabIndex={-1}
    >
      <div className="workspace-head">
        <div>
          <Kicker mark>The optimizer</Kicker>
          <h2 className="heading-3" id="workspace-title">
            Resume workspace
          </h2>
        </div>

        <ol className="workflow" aria-label="Workflow progress">
          {['Set up', 'Review', 'Export'].map((text, index) => (
            <li
              key={text}
              className={`caption-1 ${index + 1 === stage ? 'current' : ''} ${index + 1 < stage ? 'done' : ''
                }`}
              aria-current={index + 1 === stage ? 'step' : undefined}
            >
              <span>
                {index + 1 < stage ? (
                  <Icon name="check" size={12} />
                ) : (
                  `0${index + 1}`
                )}
              </span>
              {text}
            </li>
          ))}
        </ol>
      </div>

      <div className="workspace-grid">
        <UploadForm
          resumeFile={file}
          onFileChange={chooseFile}
          onRemove={remove}
          fileInputRef={input}
          provider={provider}
          setProvider={updateProvider}
          jdText={jd}
          setJdText={updateDescription}
          onAnalyze={analyze}
          loading={loading}
          busy={busy}
          error={error}
          onClearError={() => setError(null)}
        />

        <SwapPreviewList
          result={result}
          swaps={swaps}
          score={score}
          scoreMatchesSelection={scoreMatchesSelection}
          scoreRefreshing={scoreRefreshing}
          scoreError={scoreError}
          onRetryScore={retryScore}
          onToggle={id =>
            changeSwap(id, swap => ({
              approved: !swap.approved,
            }))
          }
          onEdit={(id, text) =>
            changeSwap(id, () => ({
              replacement: text,
            }))
          }
          onDownload={download}
          onCancelDownload={cancelDownload}
          downloadFormat={downloadFormat}
          loading={loading}
          exportError={exportError}
          onClearExportError={() => setExportError('')}
          downloaded={downloaded}
        />
      </div>
    </section>
  )
}