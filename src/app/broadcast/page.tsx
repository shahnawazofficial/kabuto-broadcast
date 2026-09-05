import type { Metadata } from 'next'
import BroadcastShell from '@/components/broadcast/BroadcastShell'

export const metadata: Metadata = {
  title: 'Broadcast Control | Kabuto Esports',
  description: 'Kabuto Esports live broadcast control panel — manage overlays, match info, teams, and players.',
}

export default function BroadcastPage() {
  return <BroadcastShell />
}
