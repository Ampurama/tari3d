import { lazy, Suspense, useMemo } from 'react'
import { hasWebGL } from './lib/device'
import Fallback, { ErrorBoundary } from './components/ui/Fallback'
import LoadingScreen from './components/ui/LoadingScreen'
import IntroOverlay from './components/ui/IntroOverlay'
import Hud from './components/ui/Hud'
import MemoriesOverlay from './components/ui/MemoriesOverlay'
import LetterOverlay from './components/ui/LetterOverlay'
import DistanceOverlay from './components/ui/DistanceOverlay'
import FinaleOverlay, { Curtain } from './components/ui/FinaleOverlay'
import LaneOverlay from './components/ui/LaneOverlay'
import CapsuleOverlay from './components/ui/CapsuleOverlay'
import ConstellationOverlay from './components/ui/ConstellationOverlay'

const Experience = lazy(() => import('./components/three/Experience'))

export default function App() {
  const webgl = useMemo(hasWebGL, [])
  if (!webgl) return <Fallback />

  return (
    <ErrorBoundary fallback={<Fallback />}>
      <main className="app">
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
        <IntroOverlay />
        <MemoriesOverlay />
        <LaneOverlay />
        <CapsuleOverlay />
        <ConstellationOverlay />
        <LetterOverlay />
        <DistanceOverlay />
        <FinaleOverlay />
        <Hud />
        <Curtain />
        <LoadingScreen />
      </main>
    </ErrorBoundary>
  )
}
