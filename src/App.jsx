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
import PicnicUI from './components/ui/PicnicUI'
import CouplePanel from './components/ui/CouplePanel'
import HomePanel from './components/ui/HomePanel'
import DatePanel from './components/ui/DatePanel'
import { MoodStrip } from './components/ui/LifeUI'
import PetPanel from './components/ui/PetPanel'
import CafeUI from './components/ui/CafeUI'
import VillageUI from './components/ui/VillageUI'
import WellUI from './components/ui/WellUI'
import CarnivalUI from './components/ui/CarnivalUI'
import SkyPanel from './components/ui/SkyPanel'
import WishLetter from './components/ui/WishLetter'
import CutsceneOverlay from './components/ui/CutsceneOverlay'

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
        <PicnicUI />
        <CouplePanel />
        <HomePanel />
        <DatePanel />
        <MoodStrip />
        <PetPanel />
        <CafeUI />
        <VillageUI />
        <WellUI />
        <CarnivalUI />
        <SkyPanel />
        <WishLetter />
        <CutsceneOverlay />
        <FinaleOverlay />
        <Hud />
        <Curtain />
        <LoadingScreen />
      </main>
    </ErrorBoundary>
  )
}
