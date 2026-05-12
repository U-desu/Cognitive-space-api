import { useState } from 'react'
import { api } from '../api'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [error, setError] = useState('')

  if (!open) return null

  const handleZhihu = async () => {
    try {
      const data = await api.getZhihuAuthUrl()
      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || '知乎登录失败')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">登录</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          onClick={handleZhihu}
          className="w-full py-2 rounded-lg text-white hover:opacity-90 flex items-center justify-center gap-2 font-medium transition-all"
          style={{ backgroundColor: '#0084ff' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.56C21.751 24 24 21.75 24 18.281V5.72C24 2.249 21.75 0 18.281 0zm1.964 4.078c-.271.73-.5 1.434-.68 2.11h4.587c.545-.006.445 1.168.445 1.168H6.283c-.036.593-.114 1.196-.114 1.796h6.652s.4 1.143-.312 1.143H9.064c-.076.734-.166 1.465-.166 2.186 0 3.572 1.855 5.692 4.56 6.961-.282.224-.565.45-.834.69 1.813-.963 3.312-2.568 3.922-4.744.17.626.26 1.29.26 1.987 0 3.48-2.497 5.83-4.908 6.986 2.754-2.074 4.492-5.395 4.492-8.974 0-.59-.066-1.165-.184-1.725h2.102s.312-1.143-.363-1.143h-2.38c-.038-.6-.076-1.204-.1-1.796h3.704s.545-1.168.03-1.168h-4.13a34.044 34.044 0 00-.66-2.11h2.73s.486-1.055-.178-1.055H8.813z" />
          </svg>
          使用知乎登录
        </button>
      </div>
    </div>
  )
}
