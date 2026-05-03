import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Flashlight, FlashlightOff, ImageUp, RefreshCcw } from 'lucide-react'
import { useT } from '../lib/i18n'

type ExtendedTrackCapabilities = MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] }
type ExtendedTrackConstraintSet = MediaTrackConstraintSet & { torch?: boolean; focusMode?: string }

type JsqrModule = typeof import('jsqr')
type JsqrFn = JsqrModule['default']

type DetectedBarcode = {
  rawValue: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}
type BarcodeDetectorInstance = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance
type BarcodeDetectorStatic = BarcodeDetectorCtor & { getSupportedFormats?: () => Promise<string[]> }

type ScannerHandle = {
  stop: () => Promise<void>
  applyTorch: (on: boolean) => Promise<void>
  isTorchSupported: () => boolean
}

const VIEWFINDER_CORNERS = [
  { className: 'left-0 top-0 rounded-tl-2xl border-l-2 border-t-2' },
  { className: 'right-0 top-0 rounded-tr-2xl border-r-2 border-t-2' },
  { className: 'bottom-0 left-0 rounded-bl-2xl border-b-2 border-l-2' },
  { className: 'bottom-0 right-0 rounded-br-2xl border-b-2 border-r-2' },
] as const

function buildVideoConstraints(): MediaTrackConstraints {
  const advanced: ExtendedTrackConstraintSet[] = [{ focusMode: 'continuous' }]
  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    advanced: advanced as MediaTrackConstraintSet[],
  }
}

// When multiple QR codes appear in the frame (e.g. a sticker sheet), prefer the
// one whose centroid sits closest to the video centre — that's what the user
// is aiming the viewfinder at. Fall back to the first detected code if no
// boundingBox is provided by the implementation.
function pickCenterMostCode(codes: DetectedBarcode[], width: number, height: number): DetectedBarcode | null {
  if (codes.length === 0) return null
  if (codes.length === 1) return codes[0]
  const cx = width / 2
  const cy = height / 2
  let best: DetectedBarcode | null = null
  let bestDist = Infinity
  for (const code of codes) {
    const bb = code.boundingBox
    if (!bb) continue
    const dx = bb.x + bb.width / 2 - cx
    const dy = bb.y + bb.height / 2 - cy
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      best = code
    }
  }
  return best ?? codes[0]
}

async function detectNativeSupport(): Promise<boolean> {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorStatic }).BarcodeDetector
  if (!ctor) return false
  try {
    const formats = (await ctor.getSupportedFormats?.()) ?? []
    if (!formats.includes('qr_code')) return false
    // iOS Safari sometimes lists qr_code in getSupportedFormats but throws on
    // the very first detect() call. Verify by actually invoking detect on a
    // tiny canvas — if construction or detect fails, fall back to jsQR.
    const probe = document.createElement('canvas')
    probe.width = 8
    probe.height = 8
    const detector = new ctor({ formats: ['qr_code'] })
    await detector.detect(probe)
    return true
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

// Common camera setup shared by both engines. Acquires the stream, attaches it
// to the page's <video>, plays it, and on failure releases tracks so a retry
// can request the camera again cleanly.
async function setupCameraStream(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: buildVideoConstraints(),
    audio: false,
  })
  try {
    video.srcObject = stream
    await video.play()
  } catch (err) {
    try { stream.getTracks().forEach((t) => t.stop()) } catch { /* tracks already ended */ }
    try { video.srcObject = null } catch { /* element detached */ }
    throw err
  }
  return stream
}

// Build the ScannerHandle that the page interacts with. stopFn is called first
// so each engine can flip its internal stopped flag before tracks are released.
function buildScannerHandle(
  stream: MediaStream,
  video: HTMLVideoElement,
  stopFn: () => void,
): ScannerHandle {
  const track = stream.getVideoTracks()[0] ?? null
  const caps = (track?.getCapabilities?.() as ExtendedTrackCapabilities | undefined) ?? {}
  const torchSupported = caps.torch === true
  return {
    stop: async () => {
      stopFn()
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

// Schedule the next decode tick on the next decoded video frame, falling back
// to rAF on browsers without requestVideoFrameCallback (Firefox, older Safari).
function scheduleNextTick(video: HTMLVideoElement, fn: () => void) {
  const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
  if (typeof v.requestVideoFrameCallback === 'function') {
    v.requestVideoFrameCallback(() => fn())
  } else {
    requestAnimationFrame(() => fn())
  }
}

async function startNativeScanner(
  video: HTMLVideoElement,
  onDecoded: (text: string) => void,
): Promise<ScannerHandle> {
  const stream = await setupCameraStream(video)

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
        const best = pickCenterMostCode(codes, video.videoWidth, video.videoHeight)
        if (!stopped && best?.rawValue) {
          onDecoded(best.rawValue)
        }
      } catch {
        // Frame decode failure (motion blur, partial frame); next tick will retry.
      } finally {
        busy = false
      }
    }
    if (!stopped) scheduleNextTick(video, () => void tick())
  }
  void tick()

  return buildScannerHandle(stream, video, () => { stopped = true })
}

// Fallback decoder for browsers without BarcodeDetector (notably iOS Safari and
// desktop Linux Chrome). Drives the same <video> element as the native path,
// then samples a centred square crop into an offscreen canvas every frame and
// feeds the ImageData to jsQR.
async function startJsqrScanner(
  video: HTMLVideoElement,
  onDecoded: (text: string) => void,
  moduleRef: { current: JsqrModule | null },
): Promise<ScannerHandle> {
  const jsqrModule = moduleRef.current ?? (await import('jsqr'))
  moduleRef.current = jsqrModule
  const jsqr: JsqrFn = jsqrModule.default

  const stream = await setupCameraStream(video)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let stopped = false
  let busy = false

  const tick = () => {
    if (stopped) return
    if (!busy && ctx && video.readyState >= 2 && video.videoWidth > 0) {
      busy = true
      try {
        // Sample a centred square crop sized to the smaller video dimension so
        // QR modules stay square regardless of camera aspect ratio. Cap the
        // sampled side at 720px — bigger crops slow jsQR down without helping
        // decode quality on phone-sized QR codes.
        const sSide = Math.min(video.videoWidth, video.videoHeight)
        const side = Math.min(sSide, 720)
        if (canvas.width !== side) {
          canvas.width = side
          canvas.height = side
        }
        const sx = (video.videoWidth - sSide) / 2
        const sy = (video.videoHeight - sSide) / 2
        ctx.drawImage(video, sx, sy, sSide, sSide, 0, 0, side, side)
        const image = ctx.getImageData(0, 0, side, side)
        // Live scanning is always against printed labels (dark modules on light
        // paper), so dontInvert is ~2x faster than attemptBoth with no impact
        // on success rate. Image upload uses attemptBoth because users may
        // upload dark-mode screenshots.
        const result = jsqr(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
        if (!stopped && result?.data) {
          onDecoded(result.data)
        }
      } catch {
        // Frame sample / decode failure; next tick will retry.
      } finally {
        busy = false
      }
    }
    if (!stopped) scheduleNextTick(video, tick)
  }
  tick()

  return buildScannerHandle(stream, video, () => { stopped = true })
}

async function decodeImageFile(file: File, jsqr: JsqrFn): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  try {
    // Phone photos are easily 12 MP (4032x3024) which produces ~48 MB of
    // ImageData and makes jsQR take >500 ms. Downscale anything above 1280px
    // on the long edge — QR codes in photos rarely need more detail than that.
    const maxDim = 1280
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, w, h)
    const image = ctx.getImageData(0, 0, w, h)
    const result = jsqr(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })
    return result?.data ?? null
  } finally {
    try { bitmap.close() } catch { /* ImageBitmap already closed */ }
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

function ScanPage() {
  const t = useT()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handleRef = useRef<ScannerHandle | null>(null)
  const jsqrModuleRef = useRef<JsqrModule | null>(null)
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
  const [invalidNotice, setInvalidNotice] = useState('')
  const [successFlash, setSuccessFlash] = useState(false)

  // Show a transient toast above the viewfinder. Pass force=true to bypass the
  // 2s same-text dedup — used by image upload, where every user action
  // deserves immediate feedback regardless of what the live scanner showed.
  const showInvalidNotice = useCallback((message: string, force = false) => {
    if (force) {
      lastInvalidTextRef.current = ''
      lastInvalidAtRef.current = performance.now()
    }
    setInvalidNotice(message)
    if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
    invalidTimerRef.current = window.setTimeout(() => {
      setInvalidNotice('')
      invalidTimerRef.current = null
    }, 2200)
  }, [])

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
    hasScannedRef.current = false
    const handle = handleRef.current
    handleRef.current = null
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
      showInvalidNotice(t('scan.torch.failed'), true)
    }
  }, [showInvalidNotice, torchOn])

  const handleDecodedText = useCallback((decodedText: string) => {
    if (hasScannedRef.current) return

    const route = routeFromQr(decodedText)
    if (!route) {
      // Invalid Packman QR — keep scanner alive and show a transient toast.
      // Dedup: same text within 2s does not re-trigger to avoid per-frame spam
      // when the camera holds steady on a non-Packman QR (Wi-Fi, vCard, etc.).
      const now = performance.now()
      const sameText = decodedText === lastInvalidTextRef.current
      if (sameText && now - lastInvalidAtRef.current < 2000) return

      lastInvalidTextRef.current = decodedText
      lastInvalidAtRef.current = now
      showInvalidNotice(t('scan.invalid.qr'))
      return
    }

    hasScannedRef.current = true
    feedbackOnScan()
    setSuccessFlash(true)
    setStatus(t('scan.scanned'))

    successTimerRef.current = window.setTimeout(() => {
      successTimerRef.current = null
      void navigate(route)
      void stopAll()
    }, 400)
    // t intentionally omitted: useT() returns a new function reference each
    // render, which would make this callback unstable and re-trigger the
    // scanner-start effect on every render (camera flicker / never-starts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, showInvalidNotice, stopAll])

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
      if (!videoRef.current) return

      try {
        const useNative = await detectNativeSupport()

        if (useNative) {
          try {
            const handle = await startNativeScanner(videoRef.current, handleDecodedText)
            if (cancelled || runIdRef.current !== runId) {
              await handle.stop()
              return
            }
            handleRef.current = handle
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
            // Otherwise fall through to jsQR (e.g. transient detect failure).
          }
        }

        const handle = await startJsqrScanner(videoRef.current, handleDecodedText, jsqrModuleRef)
        if (cancelled || runIdRef.current !== runId) {
          await handle.stop()
          return
        }
        handleRef.current = handle
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
    // t intentionally omitted: see handleDecodedText note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleDecodedText, retryKey, stopAll])

  // iOS Safari pauses <video> when the user backgrounds the tab (switching
  // apps, locking the phone). On return the element stays paused on the last
  // frame, leaving the viewfinder lit but frozen. Resume playback whenever
  // the page becomes visible again.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const video = videoRef.current
      if (video && handleRef.current && video.paused) {
        video.play().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const scanImage = async (file: File | undefined) => {
    if (!file) return

    try {
      const jsqrModule = jsqrModuleRef.current ?? (await import('jsqr'))
      jsqrModuleRef.current = jsqrModule
      const decoded = await decodeImageFile(file, jsqrModule.default)
      if (!decoded) {
        showInvalidNotice(t('scan.invalid.image'), true)
        return
      }
      handleDecodedText(decoded)
    } catch (err) {
      // Surface the actual error so deployment-specific failures (e.g. the
      // jsQR chunk failing to load behind a CDN) are visible instead of being
      // masked as "no QR detected".
      console.error('[scan] image decode failed', err)
      const raw = err instanceof Error ? err.message : String(err ?? '')
      const isLoadFailure = /failed to fetch dynamically imported module|loading chunk|importscripts|networkerror/i.test(raw)
      showInvalidNotice(isLoadFailure ? `${t('scan.invalid.image')}: ${raw}` : t('scan.invalid.image'), true)
    }
  }

  return (
    <div className="mx-auto max-w-md page-stack">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('scan.title')}</h1>
        <p className="page-subtitle">{t('scan.subtitle')}</p>
      </div>

      <div className={`card overflow-hidden ${error ? 'hidden' : ''}`}>
        <div className="relative aspect-square w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            muted
          />

          {(isScanning || successFlash) && (
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute left-1/2 top-1/2 aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-2xl"
                style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}
              >
                {VIEWFINDER_CORNERS.map((corner, i) => (
                  <span
                    key={i}
                    className={`absolute h-7 w-7 transition-all duration-150 ${corner.className} ${successFlash ? 'border-brand-500' : 'border-white'}`}
                    style={successFlash ? { filter: 'drop-shadow(0 0 8px rgba(222,39,44,0.95))' } : undefined}
                  />
                ))}
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

      <p className="text-center text-xs text-muted">
        {status || t('scan.aimHint')}
      </p>
    </div>
  )
}

export const Route = createFileRoute('/scan')({ component: ScanPage })
