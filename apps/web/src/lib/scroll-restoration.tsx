import { useEffect, useRef, useCallback } from 'react'
import { useRouter, useNavigate } from '@tanstack/react-router'

const STORAGE_PREFIX = 'packman:scroll:'

// Counts in-app navigations so `useGoBack` knows whether history.back() will
// land somewhere in our app. Maintained in sessionStorage so deep-linked
// detail pages can still detect a lack of in-app history after a refresh.
const DEPTH_KEY = 'packman:nav-depth'

// Path prefixes whose scroll position should be restored on back navigation.
// Covers the dashboard (/) plus the list pages and their detail variants
// (/boxes/<id>, /items/<id>) so a user who scrolled inside any of these lands
// at the same spot when coming back. Other pages reset to top.
const RESTORE_PREFIXES = ['/', '/items', '/boxes', '/batteries', '/stickers']

function storageKey(href: string) {
  return STORAGE_PREFIX + href
}

function shouldRestore(pathname: string) {
  return RESTORE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'),
  )
}

function getDepth(): number {
  try {
    const v = parseInt(sessionStorage.getItem(DEPTH_KEY) ?? '0', 10)
    return Number.isFinite(v) && v > 0 ? v : 0
  } catch { return 0 }
}

function setDepth(n: number) {
  try { sessionStorage.setItem(DEPTH_KEY, String(Math.max(0, n))) } catch {}
}

// Timestamp of the most recent popstate event. Used by isRecentPopNavigation
// so pages can detect "was I mounted via back/forward?" — useful when filter
// state should restore on back but reset on refresh / nav click / fresh load.
let lastPopAt = 0
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { lastPopAt = Date.now() })
}

/**
 * True if a popstate event fired within the last `maxAgeMs` ms. Lets a page
 * decide on mount whether it arrived via browser back/forward (restore state)
 * vs. a fresh entry like refresh, nav click, or deep link (reset state).
 */
export function isRecentPopNavigation(maxAgeMs = 1000): boolean {
  return lastPopAt > 0 && Date.now() - lastPopAt < maxAgeMs
}

/**
 * Persist + restore scroll position of a given container element across
 * client-side navigations. Saves on scroll (throttled) and restores on POP
 * (history back/forward). New navigations (PUSH/REPLACE) reset to top.
 */
export function useScrollRestoration(containerRef: React.RefObject<HTMLElement>) {
  const router = useRouter()
  const lastHrefRef = useRef<string>(router.state.location.href)
  // Set by the popstate listener; consumed by the next router.onResolved.
  // popstate fires on browser/programmatic back & forward, so this is the
  // reliable cross-version signal for "this navigation is a POP".
  const popPendingRef = useRef(false)

  // Save on scroll (throttled via rAF).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!shouldRestore(router.state.location.pathname)) return
        try {
          sessionStorage.setItem(storageKey(router.state.location.href), String(el.scrollTop))
        } catch {
          // sessionStorage may be unavailable (private mode / quota); ignore.
        }
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [containerRef, router])

  // Mark the next router resolution as a POP whenever the browser fires
  // popstate (back/forward, or our useGoBack -> router.history.back()).
  useEffect(() => {
    const onPop = () => { popPendingRef.current = true }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Restore on navigation + track in-app navigation depth.
  useEffect(() => {
    return router.subscribe('onResolved', ({ toLocation }: { toLocation: { href: string; pathname: string } }) => {
      const el = containerRef.current
      const prev = lastHrefRef.current
      lastHrefRef.current = toLocation.href

      // Consume the popstate flag even on no-op resolves so a hashchange-style
      // popstate doesn't leak into the next real navigation as a phantom POP.
      const isPop = popPendingRef.current
      popPendingRef.current = false

      if (prev === toLocation.href) return

      // Maintain depth counter for useGoBack. POP shrinks, everything else
      // grows. The initial-load case is handled by the href early-return.
      if (isPop) setDepth(getDepth() - 1)
      else setDepth(getDepth() + 1)

      if (!el) return
      if (isPop && shouldRestore(toLocation.pathname)) {
        const saved = (() => {
          try { return sessionStorage.getItem(storageKey(toLocation.href)) } catch { return null }
        })()
        const top = saved ? parseInt(saved, 10) : 0
        // Wait two frames so the destination's content has a chance to hydrate
        // (TanStack Query restores cached pages synchronously, but layout still
        // needs a tick to settle for infinite lists).
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.scrollTop = isNaN(top) ? 0 : top
          })
        })
      } else {
        el.scrollTop = 0
      }
    })
  }, [containerRef, router])
}

/**
 * Returns a function that navigates one entry back in browser history. When
 * there is no in-app history (deep link, direct refresh on a detail page), it
 * falls back to the given route so the user is never stranded.
 *
 * Tracks in-app navigations via a sessionStorage counter that
 * `useScrollRestoration` maintains; this avoids relying on internal fields
 * of TanStack's history (which differ across versions).
 */
export function useGoBack(fallback: { to: string; search?: Record<string, unknown> }) {
  const router = useRouter()
  const navigate = useNavigate()
  return useCallback(() => {
    if (getDepth() > 0) router.history.back()
    else navigate(fallback as Parameters<typeof navigate>[0])
  }, [router, navigate, fallback])
}
