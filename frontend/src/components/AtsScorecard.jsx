import { Icon } from './Ui'

function clampScore(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(100, Math.round(number)))
}

function scoreTone(score) {
  if (score >= 75) return 'strong'
  if (score >= 50) return 'building'

  return 'starting'
}

function scoreMessage(score) {
  if (score >= 75) {
    return 'Strong keyword coverage for this role.'
  }

  if (score >= 50) {
    return 'A solid start, with clear opportunities to improve.'
  }

  return 'There is room to better align your experience to this role.'
}

function SkillGroup({ title, skills, tone }) {
  if (!skills?.length) return null

  return (
    <div className={`skill-group ${tone || ''}`}>
      <span className="caption-4">{title}</span>

      <ul>
        {skills.map(skill => (
          <li key={skill} className="caption-2">
            {skill}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AtsScorecard({
  score,
  refreshing,
  error,
  onRetry,
  selectionIsCurrent = true,
}) {
  if (!score) return null

  const before = clampScore(score.before)
  const current = clampScore(score.current)
  const matched = Array.isArray(score.matched) ? score.matched : []
  const gained = Array.isArray(score.gained) ? score.gained : []
  const missing = Array.isArray(score.missing) ? score.missing : []
  const totalSkills = matched.length + missing.length
  const change = current - before
  const tone = scoreTone(current)

  const modeLabel =
    score.mode === 'model_estimate'
      ? 'Model estimate'
      : 'Skill coverage'

  const changeLabel = change > 0 ? `+${change}` : String(change)

  const title = selectionIsCurrent
    ? 'Your current role fit'
    : 'Last successful role fit'

  const scoreLabel = selectionIsCurrent
    ? 'Current ATS score'
    : 'Last successful ATS score'

  const selectionLabel = selectionIsCurrent
    ? 'Current selection'
    : 'Last successful selection'

  const detailsLabel = selectionIsCurrent
    ? 'See score details'
    : 'See last successful score details'

  const stateLabel = refreshing
    ? 'Updating score'
    : selectionIsCurrent
      ? modeLabel
      : 'Last successful score'

  return (
    <section
      className={`ats-scorecard score-${tone}`}
      aria-labelledby="ats-score-title"
    >
      <div className="ats-score-topline">
        <div>
          <span className="caption-3 score-eyebrow">
            <Icon name="target" size={15} />
            ATS scorer
          </span>

          <h4 className="heading-6" id="ats-score-title">
            {title}
          </h4>

          <p className="caption-2 muted">
            {selectionIsCurrent
              ? scoreMessage(current)
              : 'This score belongs to an earlier edit selection.'}
          </p>
        </div>

        <span
          className={`score-state caption-4 ${refreshing ? 'refreshing' : ''
            }`}
          aria-live="polite"
        >
          <Icon
            name={refreshing ? 'arrows-clockwise' : 'check-circle'}
            size={15}
          />
          {stateLabel}
        </span>
      </div>

      <div className="score-hero">
        <div>
          <span className="caption-1">{scoreLabel}</span>

          <strong
            className="score-number"
            aria-live="polite"
            aria-atomic="true"
          >
            {current}
            <small>/100</small>
          </strong>

          <span
            className={`score-change caption-2 ${change > 0 ? 'positive' : ''
              }`}
          >
            {change > 0
              ? `${changeLabel} from your starting score`
              : change < 0
                ? `${changeLabel} from your starting score`
                : 'Same as your starting score'}
          </span>
        </div>

        <div
          className="score-ring"
          aria-hidden="true"
          style={{ '--score-degrees': `${current * 3.6}deg` }}
        >
          <span>{current}%</span>
        </div>
      </div>

      <div
        className="score-progress"
        role="progressbar"
        aria-label={scoreLabel}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={current}
      >
        <span style={{ width: `${current}%` }} />
      </div>

      <dl className="score-stat-grid">
        <div>
          <dt className="caption-4">Starting score</dt>
          <dd className="title-2">{before}%</dd>
        </div>

        <div>
          <dt className="caption-4">{selectionLabel}</dt>
          <dd className="title-2">{current}%</dd>
        </div>

        <div>
          <dt className="caption-4">Skills covered</dt>
          <dd className="title-2">
            {totalSkills ? `${matched.length}/${totalSkills}` : '—'}
          </dd>
        </div>
      </dl>

      {totalSkills > 0 && (
        <details className="score-skills">
          <summary className="button-sm">
            {detailsLabel}
            <Icon name="caret-down" size={16} />
          </summary>

          <div className="score-skill-groups">
            <SkillGroup title="Matched" skills={matched} tone="matched" />
            <SkillGroup
              title="Added by your edits"
              skills={gained}
              tone="gained"
            />
            <SkillGroup
              title="Still missing"
              skills={missing}
              tone="missing"
            />
          </div>
        </details>
      )}

      {error && (
        <div className="score-error" role="status">
          <Icon name="warning-circle" size={17} />

          <span className="caption-2">{error}</span>

          <button
            type="button"
            className="quiet-btn caption-2"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}

      <p className="score-note caption-5">
        This score is calculated by your backend from the role skills it
        identified. It is an alignment signal, not a hiring prediction.
      </p>
    </section>
  )
}