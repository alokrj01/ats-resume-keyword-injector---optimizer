import AtsScorecard from './AtsScorecard'
import { Icon } from './Ui'

function PreviewDrawing() {
  return (
    <svg
      className="preview-drawing"
      width="128"
      height="80"
      viewBox="0 0 128 80"
      aria-hidden="true"
      fill="none"
    >
      <g transform="rotate(-9 54 40)">
        <rect
          x="33"
          y="10"
          width="49"
          height="59"
          rx="6"
          fill="#cae6dd"
          stroke="#366358"
          strokeWidth="1.5"
        />
        <rect
          x="39"
          y="6"
          width="49"
          height="59"
          rx="6"
          fill="#fffefa"
          stroke="#36564b"
          strokeWidth="1.5"
        />
        <path
          d="M49 19h20"
          stroke="#4e7464"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M49 28h28M49 36h24M49 44h16"
          stroke="#b5cfc3"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      <circle
        cx="82"
        cy="49"
        r="13.5"
        fill="#ffda78"
        stroke="#305448"
        strokeWidth="2"
      />
      <path
        d="M82 39v10l7 4"
        stroke="#305448"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m92 59 11 10"
        stroke="#305448"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M25 25q0 6 6 7-6 1-6 8-1-7-7-8 6-1 7-7Z"
        fill="#ef9dad"
        stroke="#7c5158"
        strokeWidth="1"
      />
      <circle cx="103" cy="21" r="2" fill="#86bbab" />
    </svg>
  )
}

function BoldText({ text, allow }) {
  const stars = text.match(/\*\*/g) || []

  if (!allow || stars.length !== 2) {
    return text.replace(/\*\*/g, '')
  }

  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part.replace(/\*\*/g, '')
      )
    )
}

function PhraseCard({ item, index, onToggle, onEdit, busy }) {
  const plain = item.replacement.replace(/\*\*/g, '').trim()
  const difference = plain.length - item.original.length

  const mightWrap =
    Math.abs(difference) / Math.max(1, item.original.length) > 0.12

  const line = item.context || item.original
  const start = line.indexOf(item.original)
  const showReplacement = item.approved && plain && start >= 0

  const echo =
    showReplacement &&
    /\band\b/i.test(plain) &&
    /^,\s*and\b/i.test(line.slice(start + item.original.length))

  return (
    <article className={`phrase ${item.approved ? '' : 'inactive'}`}>
      <div className="phrase-top">
        <label className="check-label title-4">
          <input
            type="checkbox"
            aria-label={`Apply edit ${index + 1}`}
            checked={item.approved}
            onChange={() => onToggle(item.id)}
            disabled={busy}
          />
          Edit {String(index + 1).padStart(2, '0')}
        </label>

        <span className="tag subtle caption-4">
          {item.section && item.section !== 'OTHER'
            ? item.section.toLowerCase()
            : item.category || 'Phrase'}
        </span>
      </div>

      <span className="original-phrase body-6">
        <span className="sr-only">Original: </span>
        {item.original}
      </span>

      <label className="sr-only" htmlFor={`replacement-${item.id}`}>
        Replacement for {item.original}
      </label>

      <div className="edit-box">
        <Icon name="pencil-simple" size={16} />

        <input
          id={`replacement-${item.id}`}
          className="body-3"
          type="text"
          maxLength={1000}
          disabled={!item.approved || busy}
          value={item.replacement}
          onChange={event => onEdit(item.id, event.target.value)}
        />
      </div>

      <p className="context-line body-6">
        {showReplacement ? (
          <>
            {line.slice(0, start)}
            <mark>
              <BoldText
                text={item.replacement}
                allow={item.allow_bold !== false}
              />
            </mark>
            {line.slice(start + item.original.length)}
          </>
        ) : (
          line
        )}
      </p>

      <div className="phrase-meta caption-5">
        <span>
          {item.allow_bold === false
            ? 'Plain text in this section'
            : 'Use ** around one word to bold it'}
        </span>

        <span className={mightWrap ? 'warn-text' : ''}>
          {difference > 0 ? '+' : ''}
          {difference} chars
          {mightWrap ? ' · May wrap' : ''}
        </span>
      </div>

      {echo && (
        <p className="caption-2 warn-text">
          The sentence continues with “, and”. Check the phrasing in context.
        </p>
      )}
    </article>
  )
}

function Skeleton() {
  return (
    <div className="review-skeleton" role="status">
      <span className="sr-only">
        Reading the resume and comparing it with the job description.
      </span>
      <div />
      <i />
      <i />
      <div />
      <i />
    </div>
  )
}

export default function SwapPreviewList({
  result,
  swaps,
  score,
  scoreMatchesSelection,
  scoreRefreshing,
  scoreError,
  onRetryScore,
  onToggle,
  onEdit,
  onDownload,
  onCancelDownload,
  downloadFormat,
  loading,
  exportError,
  onClearExportError,
  downloaded,
}) {
  const activeCount = swaps.filter(
    item =>
      item.approved &&
      item.replacement.replace(/\*\*/g, '').trim()
  ).length

  const busy = loading || Boolean(downloadFormat)

  const status = loading
    ? 'Analyzing'
    : result
      ? 'Live review'
      : 'Awaiting input'

  const roleLabel = [result?.title, result?.company]
    .filter(Boolean)
    .join(' · ')

  const exportMessage = downloadFormat
    ? `Preparing your ${downloadFormat.toUpperCase()} download. You can cancel and keep your approved edits.`
    : downloaded ||
    (activeCount
      ? 'Only active edits are included in your download.'
      : 'No edits are active, so the exported copy will match your uploaded resume.')

  return (
    <section
      className="panel review-panel"
      id="review"
      aria-labelledby="review-title"
      tabIndex={-1}
    >
      <div className="panel-head">
        <span className="tile pink">
          <Icon name="chart-bar" size={24} />
        </span>

        <div>
          <h3 className="heading-6" id="review-title">
            ATS review
          </h3>
          <p className="caption-2 muted">
            Your live score, skills, and suggested edits
          </p>
        </div>

        <span
          className={`status caption-4 ${result || loading ? 'ready' : ''}`}
        >
          <i />
          {status}
        </span>
      </div>

      {loading ? (
        <Skeleton />
      ) : !result ? (
        <div className="review-empty">
          <PreviewDrawing />
          <h4 className="heading-5">Your ATS results appear here</h4>
          <p className="body-6 muted">
            Upload your DOCX and paste a real job description. Your backend
            will return the score, skill coverage, and reviewable phrase edits.
          </p>
        </div>
      ) : (
        <div className="review-content">
          <div className="review-source">
            <Icon name="file-doc" size={16} />

            <div>
              <span className="caption-1">
                {result.sourceName || 'Analyzed resume'}
              </span>

              {roleLabel && (
                <span className="caption-2 muted">{roleLabel}</span>
              )}
            </div>

            {result.modelUsed && (
              <span
                className="analysis-model caption-5"
                title={result.modelUsed}
              >
                {result.modelUsed}
              </span>
            )}
          </div>

          <AtsScorecard
            score={score}
            selectionIsCurrent={scoreMatchesSelection}
            refreshing={scoreRefreshing}
            error={scoreError}
            onRetry={onRetryScore}
          />

          <div className="queue-label">
            <h4 className="title-3">Suggested phrase edits</h4>

            <span className="caption-2 muted">
              {activeCount} of {swaps.length} active
            </span>
          </div>

          {swaps.length ? (
            <div className="phrase-list">
              {swaps.map((item, index) => (
                <PhraseCard
                  key={item.id}
                  item={item}
                  index={index}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  busy={busy}
                />
              ))}
            </div>
          ) : (
            <p className="empty-small body-6 muted">
              Your backend did not return any safe phrase edits for this resume
              and role. Review the ATS score details above, then try a different
              job description if needed.
            </p>
          )}

          <div className="export-bar">
            <div className="export-buttons">
              {['docx', 'pdf'].map(format => (
                <button
                  key={format}
                  className={`btn ${format === 'pdf' ? 'primary' : 'secondary'
                    } button-sm`}
                  onClick={() => onDownload(format)}
                  disabled={busy}
                >
                  <Icon
                    name={format === 'pdf' ? 'file-pdf' : 'file-doc'}
                    size={18}
                  />
                  {downloadFormat === format
                    ? 'Preparing…'
                    : `Download ${format.toUpperCase()}`}
                </button>
              ))}

              {downloadFormat && (
                <button
                  type="button"
                  className="btn secondary button-sm"
                  onClick={onCancelDownload}
                >
                  <Icon name="x" size={18} />
                  Cancel download
                </button>
              )}
            </div>

            <p className="caption-5 muted" role="status">
              {exportMessage}
            </p>
          </div>
        </div>
      )}

      {exportError && (
        <div className="alert" role="alert">
          <Icon name="warning-circle" size={20} />
          <p className="body-6">{exportError}</p>

          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss review message"
            onClick={onClearExportError}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {!result && !loading && (
        <div className="review-foot caption-2">
          <Icon name="lock-key-open" size={18} />
          No placeholder report—results are generated after a live analysis.
        </div>
      )}
    </section>
  )
}