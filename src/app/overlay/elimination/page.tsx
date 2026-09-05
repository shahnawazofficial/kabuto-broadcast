import type { Metadata } from 'next'
import EliminationOverlay from '@/components/overlay/EliminationOverlay'

export const metadata: Metadata = {
  title: 'Team Eliminated Overlay — Kabuto Broadcast',
  description: '1920x1080 transparent Team Eliminated broadcast graphic overlay for OBS Studio',
}

export default function OverlayEliminationPage() {
  return <EliminationOverlay />
}
