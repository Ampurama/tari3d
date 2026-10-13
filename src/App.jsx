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
import TimeMachineOverlay from './components/ui/TimeMachineOverlay'
import FutureOverlay from './components/ui/FutureOverlay'
import { CinematicOverlay, EndingLetter } from './components/ui/Ending'
import AvatarSelect from './components/ui/AvatarSelect'
import SecretEnding from './components/ui/SecretEnding'

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
        <TimeMachineOverlay />
        <FutureOverlay />
        <AvatarSelect />
        <CinematicOverlay />
        <EndingLetter />
        <SecretEnding />
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
