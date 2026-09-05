import type { Metadata } from 'next'
import PlayerOverlay from '@/components/overlay/PlayerOverlay'

export const metadata: Metadata = {
  title: 'Live Player Graphic Overlay — Kabuto Broadcast',
  description: '1920x1080 transparent live player graphic overlay for OBS Studio',
}

export default function OverlayPlayerPage() {
  return <PlayerOverlay />
}
