import type { Metadata } from 'next'
import MatchOverlay from '@/components/overlay/MatchOverlay'

export const metadata: Metadata = {
  title: 'Match Graphic Overlay — Kabuto Broadcast',
  description: '1920x1080 transparent Match Graphic broadcast overlay for OBS Studio',
}

export default function OverlayMatchPage() {
  return <MatchOverlay />
}
