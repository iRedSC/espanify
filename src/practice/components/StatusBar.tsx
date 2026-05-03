type StatusBarProps = {
  level: number
  points: number
}

export function StatusBar({ level, points }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-title">espanify</span>
      </div>
      <div className="status-bar-right">
        <span className="badge">Lv {level}</span>
        <span className="badge badge--points">{points}/10</span>
      </div>
    </div>
  )
}
