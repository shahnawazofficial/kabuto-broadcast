import type { Metadata } from 'next'
import PointsOverlay from '@/components/overlay/PointsOverlay'

export const metadata: Metadata = {
  title: 'Live Points Table Overlay — Kabuto Broadcast',
  description: '1920x1080 transparent live points table overlay for OBS Studio',
}

interface PageProps {
  searchParams: Promise<{ matchId?: string; layout?: 'hud' | 'full' }>
}

export default async function OverlayPointsPage({ searchParams }: PageProps) {
  const { matchId, layout } = await searchParams

  return <PointsOverlay initialMatchId={matchId} initialLayout={layout ?? 'hud'} />
}
