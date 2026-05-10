import Logo from './Logo'

interface Props {
  open: boolean
  message?: string
}

export default function LoadingOverlay({ open, message = '加载中...' }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <div
          className="w-20 h-20 rounded-full border-2 flex items-center justify-center animate-pulse"
          style={{ borderColor: 'rgba(255,255,255,0.15)' }}
        >
          <Logo size={40} />
        </div>
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: '2px dashed rgba(255,255,255,0.1)',
            animationDuration: '6s',
          }}
        />
      </div>
      <p className="mt-5 text-sm text-white/90 font-medium animate-pulse">
        {message}
      </p>
    </div>
  )
}
