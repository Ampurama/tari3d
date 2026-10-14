import { benchRotation, spots } from '../../lib/layout'
import { FACE_CAMERA } from '../../lib/iso'
import { count } from '../../lib/device'
import { useInteractable } from '../../lib/interactions'
import { useChapterUnlocked, useStore } from '../../store'
import { audio } from '../../audio/engine'
import { FloatingRocks } from './Island'
import { Bench, BlossomTree, SecretArch, Telescope } from './Props'
import { Interactive } from './Bits'
import { DriftParticles, Fireflies } from './Particles'
import LetterTable from './LetterTable'
import MemoryFrames from './MemoryFrames'
import FloatingHearts from './FloatingHearts'
import LoveCapsule from './LoveCapsule'
import HiddenHearts from './HiddenHearts'
import TimeMachine from './TimeMachine'
import FuturePortal from './FuturePortal'
import { DistantIslands, IslandGround, Lake, LuminousPaths, PathLanterns, PlaceNames, ShoreGlow, Waterfall } from './Terrain'
import Vegetation from './Vegetation'
import LoveTree from './LoveTree'
import LittleThings from './LittleThings'
import Discoveries from './Discoveries'
import Companion from './Companion'
import Picnic from './Picnic'
import Decor from './Decor'
import Wildlife from './Wildlife'
import CoupleWorld from './CoupleWorld'
import HomeIsland from './HomeIsland'
import DateWorld from './DateWorld'
import Pet from './Pet'
import SkyIsland from './SkyIsland'
import Balloon from './Balloon'
import WestIsles from './WestIsles'
import CutsceneWorld from './CutsceneWorld'
import { BonusHeart, Envelope, GlowFlowers } from './StoryObjects'


/** Lets an older feature also be used with the E key / interact button when the avatar is close. */
function Station({ id, position, label, radius = 1.8, onUse }) {
  useInteractable(id, { position, radius, label, onInteract: onUse })
  return null
}

/** The main floating island — the expanded world — and everything on it. */
export default function World() {
  const goTo = useStore((s) => s.goTo)
  const startFinale = useStore((s) => s.startFinale)
  const openFuture = useStore((s) => s.openFuture)
  const travelToMiles = useStore((s) => s.travelToMiles)
  const letterRead = useStore((s) => s.letterRead)
  const view = useStore((s) => s.view)
  const ended = useStore((s) => s.mainEndingSeen)
  const milesOpen = useChapterUnlocked('miles')

  const open = (v) => () => {
    audio.sparkle()
    goTo(v)
  }
  const toMiles = () => {
    audio.sparkle()
    travelToMiles()
  }
  const toFinale = () => {
    audio.sparkle()
    startFinale()
  }

  return (
    <group visible={view !== 'finale' && view !== 'finalRoom'}>
      <IslandGround />
      <Lake />
      <Waterfall />
      <LuminousPaths />
      <PlaceNames />
      <PathLanterns />
      <ShoreGlow />
      <Vegetation />
      <DistantIslands />
      <FloatingRocks />
      <LoveTree />

      {/* the story */}
      <LittleThings />
      <Companion />
      <Decor />
      <Wildlife />
      <CoupleWorld />
      <HomeIsland />
      <DateWorld />
      <Pet />
      <SkyIsland />
      <Balloon />
      <WestIsles />
      <CutsceneWorld />
      <GlowFlowers />
      <Picnic />
      <Envelope />
      <BonusHeart />
      <Discoveries />

      {/* older places, now living in the island's zones */}
      <BlossomTree position={spots.gardenTree} />
      <Bench position={spots.bench} rotation={[0, benchRotation, 0]} />
      <LoveCapsule position={spots.capsule} rotation={[0, benchRotation + 0.4, 0]} scale={0.8} />
      <Station id="capsule" position={spots.bench} label="Open the Love Capsule" onUse={open('capsule')} />

      <Interactive label="A letter for you" onSelect={open('letter')} position={spots.table} sparkleOffset={[0.05, 1.05, 0.05]}>
        <LetterTable rotation={[0, FACE_CAMERA + 0.07, 0]} />
      </Interactive>
      <Station id="letter-table" position={spots.table} label="Open the letter on the table" onUse={open('letter')} />

      <Interactive label={milesOpen ? 'Look across the sky' : 'A telescope'} onSelect={toMiles} position={spots.telescope} sparkleOffset={[0.25, 1.45, 0]} sparkleColor="#d9c6ff">
        <Telescope rotation={[0, -2.2, 0]} />
      </Interactive>
      <Station id="telescope" position={spots.telescope} label={milesOpen ? 'Look across the sky (Chapter 3)' : 'Look through the telescope'} onUse={toMiles} />

      <Interactive label={letterRead ? 'One last thing…' : 'Locked ♡'} onSelect={toFinale} position={spots.arch} sparkleOffset={[0, 2.35, 0]} sparkleColor={letterRead ? '#ff9fd0' : '#8f86b8'}>
        <SecretArch rotation={[0, FACE_CAMERA + 0.15, 0]} />
      </Interactive>
      <Station id="arch" position={spots.arch} label={letterRead ? 'Step through the heart arch' : 'A sleeping heart arch'} onUse={toFinale} />

      <TimeMachine position={spots.timeMachine} rotation={[0, FACE_CAMERA - 0.03, 0]} />
      <Station id="time-machine" position={spots.timeMachine} label="Use the Time Machine" onUse={open('timemachine')} />
      <FuturePortal position={spots.portal} rotation={[0, FACE_CAMERA + 0.2, 0]} />
      <Station
        id="portal"
        position={spots.portal}
        label="Step into the Future Simulator"
        onUse={() => {
          audio.sparkle()
          openFuture(0)
        }}
      />

      <MemoryFrames />
      <FloatingHearts />
      <HiddenHearts group="island" />
      <HiddenHearts group="sky" />

      {/* the finale's fireflies around the Love Tree (a few, not a swarm) */}
      {(view === 'cinematic' || ended) && <Fireflies count={count(34, 16)} area={[7, 3.5, 7]} center={[0, 1.4, 0]} seed={77} colors={['#ffe2a8', '#ffd6ea']} />}
      {/* a few petals drifting over the island */}
      <DriftParticles position={[0, 3, 0]} count={count(30, 14)} area={[24, 8, 24]} size={0.14} speed={0.16} direction={-1} texture="petal" seed={12} intensity={0.9} />
    </group>
  )
}
