import type { Metadata } from 'next'
import BroadcastDashboard from '@/components/broadcast/BroadcastDashboard'

export const metadata: Metadata = {
  title: 'Broadcast Control | Kabuto Esports',
  description: 'Kabuto Esports live broadcast control panel — manage overlays, match info, and player graphics.',
}

export default function BroadcastPage() {
  return <BroadcastDashboard />
}
