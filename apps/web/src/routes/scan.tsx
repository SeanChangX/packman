import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, RefreshCcw } from 'lucide-react'

type Html5QrcodeCtor = new (elementId: string) => {
  start: (
    cameraIdOrConfig: string | { facingMode: string | { ideal: string } },
    config: {
      fps: number
      qrbox: { width: number; height: number } | ((viewfinderWidth: number, viewfinderHeight: number) => { width: number; height: number })
      aspectRatio?: number
      disableFlip?: boolean
    },
    onSuccess: (decodedText: string) => void,
    onError?: () => void,
  ) => Promise<void>
  pause: (shouldPauseVideo?: boolean) => void
  stop: () => Promise<void>
  clear: () => void
  scanFile: (file: File, showImage?: boolean) => Promise<string>
}

interface Html5QrcodeModule {
  Html5Qrcode: Html5QrcodeCtor & {
    getCameras: () => Promise<Array<{ id: string; label: string }>>
  }
}

const SCANNER_ID = 'qr-scanner'
const SCAN_CONFIG = {
  fps: 15,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
    const size = Math.floor(Math.min(Math.max(minEdge * 0.82, 280), 420))
    return { width: size, height: size }
  },
  aspectRatio: 1,
  disableFlip: true,
}

function scanErrorMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const message = raw.toLowerCase()

  if (!window.isSecureContext) {
    return '相機需要 HTTPS 或 localhost 才能啟動'
  }
  if (message.includes('notallowed') || message.includes('permission') || message.includes('denied')) {
    return '相機權限被拒絕，請在瀏覽器設定允許此網站使用相機'
  }
  if (message.includes('notfound') || message.includes('overconstrained') || message.includes('device not found')) {
    return '找不到可用相機'
  }
  if (message.includes('notreadable') || message.includes('track start')) {
    return '相機正在被其他程式使用，請關閉其他相機 App 後重試'
  }

  return raw || '無法啟動相機'
}

function routeFromQr(decodedText: string) {
  let path = decodedText.trim()

  try {
    path = new URL(path).pathname
  } catch {
    // QR code may already contain an app-relative path.
  }

  const boxMatch = path.match(/^\/boxes\/([^/?#]+)/)
  if (boxMatch) return { to: '/boxes/$id' as const, params: { id: boxMatch[1] } }

  const itemMatch = path.match(/^\/items\/([^/?#]+)/)
  if (itemMatch) return { to: '/items/$id' as const, params: { id: itemMatch[1] } }

  return null
}

function ScanPage() {
  const navigate = useNavigate()
  const scannerRef = useRef<InstanceType<Html5QrcodeCtor> | null>(null)
  const html5ModuleRef = useRef<Html5QrcodeModule | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('啟動相機中...')
  const [isScanning, setIsScanning] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const runIdRef = useRef(0)
  const hasScannedRef = useRef(false)

  const stopScanner = useCallback(async (scanner = scannerRef.current) => {
    if (!scanner) return
    if (scannerRef.current === scanner) scannerRef.current = null

    try {
      await scanner.stop()
    } catch {
      // stop() rejects when the scanner never fully started.
    }

    try {
      scanner.clear()
    } catch {
      // clear() can fail after partial startup; a retry will recreate the instance.
    }
  }, [])

  const handleDecodedText = useCallback((decodedText: string) => {
    if (hasScannedRef.current) return

    const route = routeFromQr(decodedText)
    if (!route) {
      setError('這不是 Packman 的箱子或物品 QR Code')
      return
    }

    hasScannedRef.current = true
    setIsScanning(false)
    setStatus('已掃描，正在開啟...')

    const scanner = scannerRef.current
    try {
      scanner?.pause(true)
    } catch {
      // pause() can fail if the scanner is already stopping; stopScanner handles cleanup.
    }

    void navigate(route)
    void stopScanner(scanner)
  }, [navigate, stopScanner])

  useEffect(() => {
    let cancelled = false
    const runId = ++runIdRef.current

    const startScanner = async () => {
      setError('')
      setStatus('啟動相機中...')
      setIsScanning(false)
      hasScannedRef.current = false

      if (!window.isSecureContext) {
        setError('相機需要 HTTPS 或 localhost 才能啟動')
        setStatus('')
        return
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('此瀏覽器不支援相機掃描')
        setStatus('')
        return
      }

      try {
        const html5Module = html5ModuleRef.current ?? (await import('html5-qrcode') as Html5QrcodeModule)
        html5ModuleRef.current = html5Module

        const scanner = new html5Module.Html5Qrcode(SCANNER_ID)
        scannerRef.current = scanner

        const cameras = await html5Module.Html5Qrcode.getCameras().catch(() => [])
        const preferredCamera = cameras.find((camera) => /back|rear|environment|後|背/i.test(camera.label)) ?? cameras[0]

        if (cancelled || runIdRef.current !== runId) {
          await stopScanner(scanner)
          return
        }

        await scanner.start(
          preferredCamera?.id ?? { facingMode: { ideal: 'environment' } },
          SCAN_CONFIG,
          handleDecodedText,
          undefined,
        )

        if (!cancelled && runIdRef.current === runId) {
          setIsScanning(true)
          setStatus('對準箱子或物品上的 QR Code')
        } else {
          await stopScanner(scanner)
        }
      } catch (err) {
        if (!cancelled && runIdRef.current === runId) {
          setError(scanErrorMessage(err))
          setStatus('')
          setIsScanning(false)
          await stopScanner()
        }
      }
    }

    void startScanner()
    return () => {
      cancelled = true
      void stopScanner()
    }
  }, [handleDecodedText, retryKey, stopScanner])

  const scanImage = async (file: File | undefined) => {
    if (!file) return

    try {
      setError('')
      setStatus('讀取圖片中...')
      await stopScanner()
      const html5Module = html5ModuleRef.current ?? (await import('html5-qrcode') as Html5QrcodeModule)
      html5ModuleRef.current = html5Module
      const scanner = scannerRef.current ?? new html5Module.Html5Qrcode(SCANNER_ID)
      scannerRef.current = scanner
      const decodedText = await scanner.scanFile(file, false)
      handleDecodedText(decodedText)
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法辨識圖片中的 QR Code')
      setStatus('')
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">掃描 QR Code</h1>
        <p className="page-subtitle">掃描箱子或物品上的 QR Code</p>
      </div>

      <div className="card overflow-hidden">
        <div id={SCANNER_ID} className="min-h-[18rem] w-full overflow-hidden" />
        {!isScanning && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
            <Camera className="h-12 w-12" />
            <p className="text-sm">{status}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-4 text-center text-sm text-brand-500">
          <Camera className="mx-auto mb-2 h-8 w-8" />
          <p className="font-semibold">{error}</p>
          <p className="mt-1 text-xs text-muted">請允許瀏覽器存取相機，或改用圖片掃描</p>
          <button className="btn-secondary mt-4 w-full gap-2" onClick={() => setRetryKey((key) => key + 1)}>
            <RefreshCcw className="h-4 w-4" />
            重新啟動相機
          </button>
        </div>
      )}

      <label className="btn-secondary flex w-full cursor-pointer justify-center gap-2">
        <ImageUp className="h-4 w-4" />
        從圖片掃描
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void scanImage(event.target.files?.[0])}
        />
      </label>

      <p className="text-center text-xs text-muted">
        {status || '對準箱子或物品上的 QR Code，系統將自動跳轉'}
      </p>
    </div>
  )
}

export const Route = createFileRoute('/scan')({ component: ScanPage })
