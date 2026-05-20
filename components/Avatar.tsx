'use client'

interface AvatarProps {
  url: string | null | undefined
  username: string
  size: number
}

export function Avatar({ url, username, size }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={`@${username}`}
        width={size}
        height={size}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', border: '1px solid var(--border2)',
          flexShrink: 0, display: 'block',
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'var(--green-bg)', border: '1px solid var(--green-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-geist-mono)', fontSize: Math.round(size * 0.32),
      color: 'var(--green)', flexShrink: 0,
    }}>
      {(username || '?').slice(0, 2).toUpperCase()}
    </div>
  )
}
