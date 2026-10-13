import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor, Preload } from '@react-three/drei'
import { tier } from '../../lib/device'
import { useStore } from '../../store'
import CameraDirector from './CameraDirector'
import Sky from './Sky'
import World from './World'
import IntroHeart from './IntroHeart'
import DistanceWorld from './DistanceWorld'
import FinaleHeart from './FinaleHeart'
import MemoryLane from './MemoryLane'
import Constellation from './Constellation'
import DebugBridge from './DebugBridge'
import { Effects, Lights } from './Atmosphere'

export default function Experience() {
  const [dpr, setDpr] = useState(tier === 'high' ? 1.75 : 1.5)

  return (
    <Canvas
      className="scene"
      shadows="percentage"
      dpr={[1, dpr]}
      camera={{ fov: 45, near: 0.1, far: 1500, position: [0, 70, 72] }}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#05051a')
        // give textures a moment to register with the loading manager before we call it ready
        setTimeout(() => useStore.setState({ sceneReady: true }), 400)
      }}
      aria-label="Our little universe — an interactive 3D world"
    >
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} />
      <AdaptiveDpr pixelated={false} />
      <CameraDirector />
      <DebugBridge />
      <Lights />
      <Suspense fallback={null}>
        <Sky />
        <IntroHeart />
        <World />
        <MemoryLane />
        <Constellation />
        <DistanceWorld />
        <FinaleHeart />
        <Preload all />
      </Suspense>
      <Effects />
    </Canvas>
  )
}
