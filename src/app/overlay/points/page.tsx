import type { Metadata } from 'next'
import PointsOverlay from '@/components/overlay/PointsOverlay'

export const metadata: Metadata = {
  title: 'Live Points Table Overlay — Kabuto Broadcast',
  description: '1920x1080 transparent live points table overlay for OBS Studio',
}

interface PageProps {
  searchParams: Promise<{ matchId?: string }>
}

export default async function OverlayPointsPage({ searchParams }: PageProps) {
  const { matchId } = await searchParams

  return <PointsOverlay initialMatchId={matchId} />
}
