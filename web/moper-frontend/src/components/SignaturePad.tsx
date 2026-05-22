import { useRef, useState, useEffect, useCallback } from 'react'

interface SignaturePadProps {
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
  label: string
}

export function SignaturePad({ onConfirm, onCancel, label }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStroke, setHasStroke] = useState(false)

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: t.clientX - rect.left, y: t.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const start = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      const { x, y } = getPos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
      setDrawing(true)
      setHasStroke(true)
    },
    [getPos]
  )

  const move = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (!drawing) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      const { x, y } = getPos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
    },
    [drawing, getPos]
  )

  const end = useCallback(() => setDrawing(false), [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
  }, [])

  const confirm = useCallback(() => {
    if (!hasStroke) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onConfirm(dataUrl)
  }, [hasStroke, onConfirm])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-oxford-800">{label}</p>
      <div className="border-2 border-oxford-300 rounded-lg bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-[180px] block touch-none cursor-crosshair"
          style={{ width: '100%', height: 180 }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          className="px-3 py-1.5 border-2 border-oxford-400 rounded text-sm font-medium text-oxford-800 hover:bg-oxford-100"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!hasStroke}
          className="px-3 py-1.5 bg-black text-white rounded text-sm font-medium hover:bg-oxford-800 disabled:opacity-50"
        >
          Confirmar firma
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 border border-oxford-300 rounded text-sm text-oxford-700 hover:bg-oxford-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
