import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Flashlight, FlashlightOff, ImageUp, RefreshCcw } from 'lucide-react'
import { useT } from '../lib/i18n'

type ExtendedTrackCapabilities = MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] }
type ExtendedTrackConstraintSet = MediaTrackConstraintSet & { torch?: boolean; focusMode?: string }

type Html5QrcodeModule = typeof import('html5-qrcode')
type Html5QrcodeInstance = InstanceType<Html5QrcodeModule['Html5Qrcode']>

type DetectedBarcode = { rawValue: string }
type BarcodeDetectorInstance = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance
type BarcodeDetectorStatic = BarcodeDetectorCtor & { getSupportedFormats?: () => Promise<string[]> }

type ScannerHandle = {
  stop: () => Promise<void>
  applyTorch: (on: boolean) => Promise<void>
  isTorchSupported: () => boolean
}

const SCANNER_FALLBACK_ID = 'qr-scanner-fallback'
const FILE_SCANNER_ID = 'qr-file-scan'

function buildVideoConstraints(deviceId?: string): MediaTrackConstraints {
  const advanced: ExtendedTrackConstraintSet[] = [{ focusMode: 'continuous' }]
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: advanced as MediaTrackConstraintSet[],
  }
}

async function detectNativeSupport(): Promise<boolean> {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorStatic }).BarcodeDetector
  if (!ctor) return false
  try {
    const formats = (await ctor.getSupportedFormats?.()) ?? []
    return formats.includes('qr_code')
  } catch {
    return false
  }
}

let sharedAudioCtx: AudioContext | null = null
function playBeep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    sharedAudioCtx = sharedAudioCtx ?? new Ctx()
    if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume()
    const osc = sharedAudioCtx.createOscillator()
    const gain = sharedAudioCtx.createGain()
    osc.connect(gain).connect(sharedAudioCtx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    const t0 = sharedAudioCtx.currentTime
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
    osc.start(t0)
    osc.stop(t0 + 0.18)
  } catch {
    // Audio output unavailable (autoplay policy, no audio device); ignore.
  }
}

function feedbackOnScan() {
  if (typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(50) } catch { /* unsupported */ }
  }
  playBeep()
}

async function startNativeScanner(
  video: HTMLVideoElement,
  onDecoded: (text: string) => void,
): Promise<ScannerHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: buildVideoConstraints(),
    audio: false,
  })

  try {
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    video.muted = true
    await video.play()
  } catch (err) {
    // play() can reject before any frame plays (e.g. element detached, autoplay rejection); release the stream.
    try { stream.getTracks().forEach((t) => t.stop()) } catch { /* tracks already ended */ }
    try { video.srcObject = null } catch { /* element detached */ }
    throw err
  }

  const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector
  const detector = new Ctor({ formats: ['qr_code'] })

  let stopped = false
  let busy = false

  const tick = async () => {
    if (stopped) return
    if (!busy && video.readyState >= 2) {
      busy = true
      try {
        const codes = await detector.detect(video)
        if (!stopped && codes.length > 0 && codes[0].rawValue) {
          onDecoded(codes[0].rawValue)
        }
      } catch {
        // Frame decode failure (motion blur, partial frame); next tick will retry.
      } finally {
        busy = false
      }
    }
    if (stopped) return
    const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    if (typeof v.requestVideoFrameCallback === 'function') {
      v.requestVideoFrameCallback(() => void tick())
    } else {
      requestAnimationFrame(() => void tick())
    }
  }
  void tick()

  const track = stream.getVideoTracks()[0] ?? null
  const caps = (track?.getCapabilities?.() as ExtendedTrackCapabilities | undefined) ?? {}
  const torchSupported = caps.torch === true

  return {
    stop: async () => {
      stopped = true
      try { stream.getTracks().forEach((t) => t.stop()) } catch { /* track already ended */ }
      try { video.srcObject = null } catch { /* element detached */ }
    },
    applyTorch: async (on) => {
      if (!track) return
      await track.applyConstraints({
        advanced: [{ torch: on } as ExtendedTrackConstraintSet] as MediaTrackConstraintSet[],
      })
    },
    isTorchSupported: () => torchSupported,
  }
}

async function startHtml5Scanner(
  containerId: string,
  onDecoded: (text: string) => void,
  moduleRef: { current: Html5QrcodeModule | null },
): Promise<{ handle: ScannerHandle; instance: Html5QrcodeInstance }> {
  const html5Module = moduleRef.current ?? (await import('html5-qrcode'))
  moduleRef.current = html5Module

  const scanner = new html5Module.Html5Qrcode(containerId, {
    formatsToSupport: [html5Module.Html5QrcodeSupportedFormats.QR_CODE],
    verbose: false,
  })
  const cameras = await html5Module.Html5Qrcode.getCameras().catch(() => [])
  const preferred = cameras.find((c) => /back|rear|environment|後|背/i.test(c.label)) ?? cameras[0]

  await scanner.start(
    preferred?.id ?? { facingMode: { ideal: 'environment' } },
    {
      fps: 15,
      // Skip html5-qrcode's built-in qrbox so it doesn't draw its own L-corners and scan line on top of our overlay.
      videoConstraints: buildVideoConstraints(preferred?.id),
      disableFlip: true,
    },
    onDecoded,
    undefined,
  )

  let torchSupported = false
  try {
    const caps = scanner.getRunningTrackCapabilities() as ExtendedTrackCapabilities | undefined
    torchSupported = caps?.torch === true
  } catch { /* capability unsupported on this browser */ }

  return {
    instance: scanner,
    handle: {
      stop: async () => {
        try { await scanner.stop() } catch { /* not fully started */ }
        try { scanner.clear() } catch { /* partial startup */ }
      },
      applyTorch: async (on) => {
        await scanner.applyVideoConstraints({
          advanced: [{ torch: on } as ExtendedTrackConstraintSet] as MediaTrackConstraintSet[],
        })
      },
      isTorchSupported: () => torchSupported,
    },
  }
}

function scanErrorMessage(err: unknown, t: (key: string, params?: Record<string, string | number>) => string) {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const message = raw.toLowerCase()

  if (!window.isSecureContext) {
    return t('scan.error.https')
  }
  if (message.includes('notallowed') || message.includes('permission') || message.includes('denied')) {
    return t('scan.error.permission')
  }
  if (message.includes('notfound') || message.includes('overconstrained') || message.includes('device not found')) {
    return t('scan.error.notFound')
  }
  if (message.includes('notreadable') || message.includes('track start')) {
    return t('scan.error.busy')
  }

  return raw || t('scan.error.generic')
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

const SCAN_STYLES = `
#${SCANNER_FALLBACK_ID} video {
  object-fit: cover !important;
  width: 100% !important;
  height: 100% !important;
}
`

function ScanPage() {
  const t = useT()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handleRef = useRef<ScannerHandle | null>(null)
  const html5InstanceRef = useRef<Html5QrcodeInstance | null>(null)
  const html5ModuleRef = useRef<Html5QrcodeModule | null>(null)
  const runIdRef = useRef(0)
  const hasScannedRef = useRef(false)
  const lastInvalidTextRef = useRef('')
  const lastInvalidAtRef = useRef(0)
  const invalidTimerRef = useRef<number | null>(null)
  const successTimerRef = useRef<number | null>(null)

  const [error, setError] = useState('')
  const [status, setStatus] = useState(() => t('scan.starting'))
  const [isScanning, setIsScanning] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [engine, setEngine] = useState<'native' | 'html5' | null>(null)
  const [invalidNotice, setInvalidNotice] = useState('')
  const [successFlash, setSuccessFlash] = useState(false)

  const stopAll = useCallback(async () => {
    if (invalidTimerRef.current !== null) {
      window.clearTimeout(invalidTimerRef.current)
      invalidTimerRef.current = null
    }
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current)
      successTimerRef.current = null
    }
    setInvalidNotice('')
    setSuccessFlash(false)
    setTorchSupported(false)
    setTorchOn(false)
    const handle = handleRef.current
    handleRef.current = null
    html5InstanceRef.current = null
    if (handle) {
      try { await handle.stop() } catch { /* idempotent */ }
    }
  }, [])

  const toggleTorch = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    const next = !torchOn
    try {
      await handle.applyTorch(next)
      setTorchOn(next)
    } catch {
      setTorchSupported(false)
    }
  }, [torchOn])

  const handleDecodedText = useCallback((decodedText: string) => {
    if (hasScannedRef.current) return

    const route = routeFromQr(decodedText)
    if (!route) {
      // Invalid Packman QR — keep scanner alive and show a transient toast.
      // Dedup: same text within 2s does not re-trigger to avoid per-frame spam.
      const now = performance.now()
      const sameText = decodedText === lastInvalidTextRef.current
      if (sameText && now - lastInvalidAtRef.current < 2000) return

      lastInvalidTextRef.current = decodedText
      lastInvalidAtRef.current = now
      setInvalidNotice(t('scan.invalid.qr'))
      if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
      invalidTimerRef.current = window.setTimeout(() => {
        setInvalidNotice('')
        invalidTimerRef.current = null
      }, 2200)
      return
    }

    hasScannedRef.current = true
    feedbackOnScan()
    setSuccessFlash(true)
    setStatus(t('scan.scanned'))

    const instance = html5InstanceRef.current
    try { instance?.pause(true) } catch { /* already stopping */ }

    successTimerRef.current = window.setTimeout(() => {
      successTimerRef.current = null
      void navigate(route)
      void stopAll()
    }, 400)
  }, [navigate, stopAll])

  useEffect(() => {
    let cancelled = false
    const runId = ++runIdRef.current

    const start = async () => {
      setError('')
      setStatus(t('scan.starting'))
      setIsScanning(false)
      hasScannedRef.current = false

      if (!window.isSecureContext) {
        setError(t('scan.error.https'))
        setStatus('')
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('scan.error.unsupported'))
        setStatus('')
        return
      }

      try {
        const useNative = await detectNativeSupport()

        if (useNative && videoRef.current) {
          try {
            const handle = await startNativeScanner(videoRef.current, handleDecodedText)
            if (cancelled || runIdRef.current !== runId) {
              await handle.stop()
              return
            }
            handleRef.current = handle
            setEngine('native')
            setIsScanning(true)
            setStatus(t('scan.aim'))
            setTorchSupported(handle.isTorchSupported())
            return
          } catch (nativeErr) {
            if (cancelled || runIdRef.current !== runId) return
            // Permission errors should surface, not silently fall back to a doomed engine.
            const msg = nativeErr instanceof Error ? nativeErr.message.toLowerCase() : ''
            if (msg.includes('notallowed') || msg.includes('permission') || msg.includes('denied')) {
              throw nativeErr
            }
            // Otherwise fall through to html5-qrcode (e.g. transient detect failure).
          }
        }

        const { handle, instance } = await startHtml5Scanner(SCANNER_FALLBACK_ID, handleDecodedText, html5ModuleRef)
        if (cancelled || runIdRef.current !== runId) {
          await handle.stop()
          return
        }
        handleRef.current = handle
        html5InstanceRef.current = instance
        setEngine('html5')
        setIsScanning(true)
        setStatus(t('scan.aim'))
        setTorchSupported(handle.isTorchSupported())
      } catch (err) {
        if (!cancelled && runIdRef.current === runId) {
          setError(scanErrorMessage(err, t))
          setStatus('')
          setIsScanning(false)
          await stopAll()
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      void stopAll()
    }
  }, [handleDecodedText, retryKey, stopAll])

  const scanImage = async (file: File | undefined) => {
    if (!file) return

    try {
      const html5Module = html5ModuleRef.current ?? (await import('html5-qrcode'))
      html5ModuleRef.current = html5Module
      const scanner = new html5Module.Html5Qrcode(FILE_SCANNER_ID, {
        formatsToSupport: [html5Module.Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      })
      let decodedText: string
      try {
        decodedText = await scanner.scanFile(file, false)
      } finally {
        try { scanner.clear() } catch { /* harmless if not started */ }
      }
      handleDecodedText(decodedText)
    } catch {
      // No QR detected in image — show transient notice without disturbing live scanner.
      lastInvalidTextRef.current = ''
      lastInvalidAtRef.current = performance.now()
      setInvalidNotice(t('scan.invalid.image'))
      if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
      invalidTimerRef.current = window.setTimeout(() => {
        setInvalidNotice('')
        invalidTimerRef.current = null
      }, 2200)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <style>{SCAN_STYLES}</style>

      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('scan.title')}</h1>
        <p className="page-subtitle">{t('scan.subtitle')}</p>
      </div>

      <div className={`card overflow-hidden ${error ? 'hidden' : ''}`}>
        <div className="relative aspect-square w-full overflow-hidden bg-black">
          {/* Native engine renders into this video element. */}
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover ${engine === 'native' ? '' : 'hidden'}`}
            playsInline
            muted
          />
          {/* html5-qrcode injects its own video into this container. Always rendered so the library can read its dimensions on start(). */}
          <div id={SCANNER_FALLBACK_ID} className="absolute inset-0 h-full w-full" />

          {(isScanning || successFlash) && (
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute left-1/2 top-1/2 aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-2xl"
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}
              >
                <span
                  className={`absolute left-0 top-0 h-7 w-7 rounded-tl-2xl border-l-2 border-t-2 transition-all duration-150 ${successFlash ? 'border-brand-500' : 'border-white'}`}
                  style={successFlash ? { filter: 'drop-shadow(0 0 8px rgba(222,39,44,0.95))' } : undefined}
                />
                <span
                  className={`absolute right-0 top-0 h-7 w-7 rounded-tr-2xl border-r-2 border-t-2 transition-all duration-150 ${successFlash ? 'border-brand-500' : 'border-white'}`}
                  style={successFlash ? { filter: 'drop-shadow(0 0 8px rgba(222,39,44,0.95))' } : undefined}
                />
                <span
                  className={`absolute bottom-0 left-0 h-7 w-7 rounded-bl-2xl border-b-2 border-l-2 transition-all duration-150 ${successFlash ? 'border-brand-500' : 'border-white'}`}
                  style={successFlash ? { filter: 'drop-shadow(0 0 8px rgba(222,39,44,0.95))' } : undefined}
                />
                <span
                  className={`absolute bottom-0 right-0 h-7 w-7 rounded-br-2xl border-b-2 border-r-2 transition-all duration-150 ${successFlash ? 'border-brand-500' : 'border-white'}`}
                  style={successFlash ? { filter: 'drop-shadow(0 0 8px rgba(222,39,44,0.95))' } : undefined}
                />
              </div>
            </div>
          )}

          {!isScanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
              <Camera className="h-12 w-12" />
              <p className="text-sm">{status}</p>
            </div>
          )}
        </div>
      </div>

      {invalidNotice && !error && (
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-4 text-center text-sm text-brand-500">
          <p className="font-semibold">{invalidNotice}</p>
        </div>
      )}

      {isScanning && torchSupported && (
        <button className="btn-secondary flex w-full justify-center gap-2" onClick={() => void toggleTorch()}>
          {torchOn ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
          {torchOn ? t('scan.torchOff') : t('scan.torchOn')}
        </button>
      )}

      {error && (
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-4 text-center text-sm text-brand-500">
          <Camera className="mx-auto mb-2 h-8 w-8" />
          <p className="font-semibold">{error}</p>
          <p className="mt-1 text-xs text-muted">{t('scan.error.hint')}</p>
          <button className="btn-secondary mt-4 w-full gap-2" onClick={() => setRetryKey((key) => key + 1)}>
            <RefreshCcw className="h-4 w-4" />
            {t('scan.restart')}
          </button>
        </div>
      )}

      <label className="btn-secondary flex w-full cursor-pointer justify-center gap-2">
        <ImageUp className="h-4 w-4" />
        {t('scan.fromImage')}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void scanImage(event.target.files?.[0])}
        />
      </label>

      <div id={FILE_SCANNER_ID} className="hidden" />

      <p className="text-center text-xs text-muted">
        {status || t('scan.aimHint')}
      </p>
    </div>
  )
}

export const Route = createFileRoute('/scan')({ component: ScanPage })
