import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OBS Overlay — Live Points Table | Kabuto Broadcast',
  description: 'Kabuto Esports broadcast OBS browser source overlay',
}

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return <div className="obs-overlay-viewport">{children}</div>
}
