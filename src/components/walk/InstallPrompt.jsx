import { useEffect, useState } from 'react'

import { WALK } from './theme'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!deferredPrompt || installed) return null

  const install = async () => {
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <button
      type="button"
      onClick={install}
      className="px-3.5 py-2 rounded-lg border font-semibold text-xs transition-colors"
      style={{ borderColor: WALK.maroon, color: WALK.maroon }}
    >
      Install for offline use
    </button>
  )
}
