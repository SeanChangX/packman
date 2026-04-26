import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { QrCode, Camera } from 'lucide-react'

function ScanPage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<any>(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let html5QrCode: any

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        html5QrCode = new Html5Qrcode('qr-scanner')
        scannerRef.current = html5QrCode
        setScanning(true)

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            // Parse the URL to extract path
            try {
              const url = new URL(decodedText)
              const path = url.pathname
              html5QrCode.stop()
              if (path.startsWith('/boxes/') || path.startsWith('/items/')) {
                navigate({ to: path as any })
              }
            } catch {
              // Not a URL, try treating as a path directly
              if (decodedText.startsWith('/boxes/') || decodedText.startsWith('/items/')) {
                html5QrCode.stop()
                navigate({ to: decodedText as any })
              }
            }
          },
          undefined
        )
      } catch (err: any) {
        setError(err.message ?? '無法啟動相機')
        setScanning(false)
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [navigate])

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">掃描 QR Code</h1>
        <p className="page-subtitle">掃描箱子或物品上的 QR Code</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-center text-sm text-red-700">
          <Camera className="mx-auto mb-2 h-8 w-8" />
          <p>{error}</p>
          <p className="mt-1 text-xs">請允許瀏覽器存取相機</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div id="qr-scanner" ref={containerRef} className="w-full" />
        {!scanning && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
            <QrCode className="h-12 w-12" />
            <p className="text-sm">啟動相機中...</p>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        對準箱子或物品上的 QR Code，系統將自動跳轉
      </p>
    </div>
  )
}

export const Route = createFileRoute('/scan')({ component: ScanPage })
