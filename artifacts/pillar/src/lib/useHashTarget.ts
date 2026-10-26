import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const HIGHLIGHT_MS = 2500
const RETRY_MS = 100
const MAX_RETRIES = 20

/**
 * Scrolls to the element named by the URL hash and returns its id while it should be highlighted.
 * Retries briefly so a link into a page that is still loading its data lands once the element exists,
 * and re-fires on every navigation so clicking the same link twice flashes the target again.
 */
export function useHashTarget(): string | null {
  const { hash, key } = useLocation()
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    let id: string
    try {
      id = decodeURIComponent(hash.replace(/^#/, ''))
    } catch {
      id = hash.replace(/^#/, '')
    }
    if (!id) {
      setActive(null)
      return
    }
    let tries = 0
    let timer: number | undefined
    const attempt = () => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setActive(id)
        timer = window.setTimeout(() => setActive(null), HIGHLIGHT_MS)
      } else if (tries++ < MAX_RETRIES) {
        timer = window.setTimeout(attempt, RETRY_MS)
      }
    }
    attempt()
    return () => window.clearTimeout(timer)
  }, [hash, key])

  return active
}
