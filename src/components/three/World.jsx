import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { benchRotation, spots } from '../../lib/layout'
import { count } from '../../lib/device'
import { useStore } from '../../store'
import { audio } from '../../audio/engine'
import { FloatingRocks, Flowers, GlowPaths, IslandBody, mainIslandAvoid } from './Island'
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
import HeartReactor from './HeartReactor'

const faceCenter = (p) => Math.atan2(-p.x, -p.z)

/** The main floating island and everything on it. */
export default function World() {
  const root = useRef()
  const goTo = useStore((s) => s.goTo)
  const startFinale = useStore((s) => s.startFinale)
  const letterRead = useStore((s) => s.letterRead)
  const view = useStore((s) => s.view)
  const reducedMotion = useStore((s) => s.reducedMotion)

  // the whole island breathes up and down very slightly
  useFrame(({ clock }) => {
    root.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.35) * 0.08
  })

  const open = (v) => () => {
    audio.sparkle()
    goTo(v)
  }

  return (
    <group ref={root} visible={view !== 'finale' && view !== 'finalRoom'}>
      <IslandBody />
      <Flowers avoid={mainIslandAvoid} />
      <GlowPaths />
      <FloatingRocks />

      <BlossomTree position={spots.tree} />
      <Bench position={spots.bench} rotation={[0, benchRotation, 0]} />

      <Interactive label="A letter for you" onSelect={open('letter')} position={spots.table} sparkleOffset={[0.05, 1.05, 0.05]}>
        <LetterTable rotation={[0, faceCenter(spots.table) + Math.PI, 0]} />
      </Interactive>

      <Interactive label="Same sky" onSelect={open('distance')} position={spots.telescope} sparkleOffset={[0.25, 1.45, 0]} sparkleColor="#d9c6ff">
        <Telescope rotation={[0, -0.4, 0]} />
      </Interactive>

      <Interactive
        label={letterRead ? 'One last thing…' : 'Locked ♡'}
        onSelect={() => {
          audio.sparkle()
          startFinale()
        }}
        position={spots.arch}
        sparkleOffset={[0, 2.35, 0]}
        sparkleColor={letterRead ? '#ff9fd0' : '#8f86b8'}
      >
        <SecretArch rotation={[0, faceCenter(spots.arch), 0]} />
      </Interactive>

      {/* the Love Capsule jar rests on the bench seat */}
      <LoveCapsule position={spots.capsule} rotation={[0, benchRotation + 0.4, 0]} scale={0.8} />
      <TimeMachine position={spots.timeMachine} rotation={[0, 0.35, 0]} />
      <FuturePortal position={spots.portal} rotation={[0, faceCenter(spots.portal), 0]} />
      <HeartReactor />

      <MemoryFrames />
      <FloatingHearts />
      <HiddenHearts group="island" />
      <HiddenHearts group="sky" />

      <Fireflies count={count(70, 34)} area={[13, 4, 13]} center={[0, 0.5, 0]} seed={8} />
      <DriftParticles position={[0, 3.5, 0]} count={count(70, 34)} area={[18, 9, 18]} size={0.16} speed={0.16} seed={12} intensity={1.3} />
    </group>
  )
}
