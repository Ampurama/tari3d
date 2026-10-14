import { lazy, Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor, Preload } from '@react-three/drei'
import { tier } from '../../lib/device'
import { ISO } from '../../lib/iso'
import { useStore } from '../../store'
import CameraDirector from './CameraDirector'
import Sky from './Sky'
import World from './World'
import IntroHeart from './IntroHeart'
import DistanceWorld from './DistanceWorld'
import FinaleHeart from './FinaleHeart'
import MemoryLane from './MemoryLane'
import Constellation from './Constellation'
import { Effects, Lights } from './Atmosphere'
import DebugBridge from './DebugBridge'
import { PlayerAvatar, PlayerController } from './Player'
import AvatarStage from './AvatarStage'
import GuideBeacon from './GuideBeacon'

// heavy, rarely-visited places are split into their own chunks and only mounted when needed
const FutureWorlds = lazy(() => import('./FutureWorlds'))
const FinalRoom = lazy(() => import('./FinalRoom'))

export default function Experience() {
  // crisp but affordable: MSAA in the composer smooths the edges, the resolution stays moderate
  const [dpr, setDpr] = useState(tier === 'high' ? 1.6 : 1.4)
  const view = useStore((s) => s.view)

  return (
    <Canvas
      className="scene"
      shadows="percentage"
      dpr={[1, dpr]}
      camera={{ fov: ISO.skyFov, near: 0.5, far: 3000, position: [0, 70, 90] }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#05051a')
        // give textures a moment to register with the loading manager before we call it ready
        setTimeout(() => useStore.setState({ sceneReady: true }), 400)
      }}
      aria-label="Our little universe — an interactive 3D world"
    >
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.2))} />
      <CameraDirector />
      <PlayerController />
      <DebugBridge />
      <Lights />
      <Suspense fallback={null}>
        <Sky />
        <IntroHeart />
        <World />
        <PlayerAvatar />
        <GuideBeacon />
        <AvatarStage />
        <MemoryLane />
        <Constellation />
        <DistanceWorld />
        <FinaleHeart />
        <Preload all />
      </Suspense>
      <Suspense fallback={null}>
        {view === 'future' && <FutureWorlds />}
        {view === 'finalRoom' && <FinalRoom />}
      </Suspense>
      <Effects />
    </Canvas>
  )
}
