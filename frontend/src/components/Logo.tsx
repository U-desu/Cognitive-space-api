import { useState } from 'react'

interface LogoProps {
  size?: number
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

const ICON_DEFAULT = '/icon-blue/icon.png'
const ICON_HOVER = '/icon-blue/icon_side.png'

export default function Logo({ size = 28, className = '', onClick, hoverable = false }: LogoProps) {
  const [hovered, setHovered] = useState(false)

  const src = hoverable && hovered ? ICON_HOVER : ICON_DEFAULT

  return (
    <img
      src={src}
      alt="认知空间"
      className={`shrink-0 object-contain transition-all duration-200 ${className}`}
      style={{
        width: size,
        height: size,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      onMouseEnter={hoverable ? () => setHovered(true) : undefined}
      onMouseLeave={hoverable ? () => setHovered(false) : undefined}
    />
  )
}
