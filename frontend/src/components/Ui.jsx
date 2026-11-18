export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      className={`icon ${className}`}
    >
      <use href={`/art/icons.svg#${name}`} />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark title-3">
      <img src="/doc.png" alt="" width="32" height="32" />
      ATS Resume Optimizer
    </span>
  )
}

export function Kicker({ children, icon, mark = false }) {
  return (
    <span className="kicker caption-3">
      {icon && <Icon name={icon} size={16} />}
      {mark && <span className="ink-dash" aria-hidden="true" />}
      {children}
    </span>
  )
}