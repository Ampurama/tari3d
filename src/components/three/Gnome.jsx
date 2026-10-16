import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { B, C, mat, S } from './HomeFurniture'

/*
 * THE GNOMES — the little people of The Little Gnome Café and Gnome Village: a round body, an apron,
 * a big nose, rosy cheeks, a tall bendy hat and (sometimes) a beard, all procedural. One model for
 * everyone; `look` dresses them and `pose()` (read every frame) says what they're doing:
 *   { mode, tool?, cupColor? }
 * modes: idle · walk · stroll (with a staff) · wave · talk · think · wipe · brew · hand · serve ·
 *        carry (a tray) · water · dig · plant · knead · oven · arrange · read · sit · sleep
 * tools (in the hands): can · trowel · bread · book · staff · lantern · basket · tray · cup
 * (A real model can replace this one later: the village and the café only ever pass `look` and `pose`.)
 */

const WALKS = new Set(['walk', 'carry', 'stroll'])

export function Gnome({ look, pose, groupRef }) {
  const body = useRef()
  const armL = useRef()
  const armR = useRef()
  const legL = useRef()
  const legR = useRef()
  const head = useRef()
  const tools = useRef({})
  const zzz = useRef()
  // its own material for the drink (the shared ones from mat() must never be recoloured)
  const drinkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b07f58', roughness: 0.6 }), [])
  useEffect(() => () => drinkMat.dispose(), [drinkMat])
  const toolRef = (name) => (el) => {
    if (el) tools.current[name] = el
  }
  useFrame(({ clock }) => {
    const p = pose()
    const t = clock.elapsedTime + (look.phase || 0)
    const mode = p.mode
    const walking = WALKS.has(mode)
    const s = Math.sin(t * 9)
    const seated = mode === 'sit' || mode === 'sleep'
    let legs = walking ? s * 0.6 : 0
    legL.current.rotation.x = seated ? -1.4 : legs
    legR.current.rotation.x = seated ? -1.4 : -legs
    let y = walking ? Math.abs(Math.cos(t * 9)) * 0.03 : Math.sin(t * 2) * 0.008
    let lean = 0
    if (seated) y = -0.14
    if (mode === 'dig' || mode === 'plant') {
      lean = mode === 'plant' ? 0.5 : 0.3 + Math.max(0, Math.sin(t * 3)) * 0.15
      y = mode === 'plant' ? -0.08 : 0
    }
    if (mode === 'knead') lean = 0.2 + Math.sin(t * 5) * 0.06
    body.current.position.y = y
    body.current.rotation.x = lean
    if (mode === 'sleep') head.current.rotation.set(0.35, 0, 0.25 + Math.sin(t * 0.8) * 0.03)
    else if (mode === 'read') head.current.rotation.set(0.3, 0, 0)
    else if (mode === 'think') head.current.rotation.set(-0.15, 0.2, 0.12)
    else head.current.rotation.set(0, walking ? 0 : Math.sin(t * 0.7) * 0.25, Math.sin(t * 1.1) * 0.05)
    let l = [0.1, 0, -0.15]
    let r = [0.1, 0, 0.15]
    if (walking) {
      l = [-s * 0.5, 0, -0.15]
      r = [s * 0.5, 0, 0.15]
    }
    switch (mode) {
      case 'brew':
        l = [-1.2 + Math.sin(t * 6) * 0.15, 0, -0.2]
        r = [-1.3 + Math.cos(t * 5) * 0.2, 0, 0.25]
        break
      case 'wipe':
        r = [-1.0, 0, 0.3 + Math.sin(t * 3) * 0.35]
        break
      case 'hand':
      case 'serve':
        r = [-1.35, 0, 0.1]
        break
      case 'carry':
        l = [-1.5, 0, -0.35]
        r = [-1.5, 0, 0.35]
        break
      case 'wave':
        r = [-2.7, 0, 0.3 + Math.sin(t * 10) * 0.3]
        break
      case 'talk':
        r = [-0.8 - Math.max(0, Math.sin(t * 4)) * 0.4, 0, 0.3]
        break
      case 'think':
        r = [-2.2, 0, 0.55]
        break
      case 'water':
        // the can held out, tipped a little now and then
        r = [-1.2, 0, 0.15 + Math.sin(t * 1.5) * 0.08]
        break
      case 'dig':
        r = [-0.9 - Math.max(0, Math.sin(t * 3)) * 0.6, 0, 0.2]
        l = [-0.6, 0, -0.3]
        break
      case 'plant':
        l = [-1.0 + Math.sin(t * 2.4) * 0.15, 0, -0.25]
        r = [-1.0 - Math.sin(t * 2.4) * 0.15, 0, 0.25]
        break
      case 'knead':
        l = [-1.25 + Math.sin(t * 5) * 0.2, 0, -0.35]
        r = [-1.25 + Math.sin(t * 5) * 0.2, 0, 0.35]
        break
      case 'oven':
        l = [-1.45, 0, -0.3]
        r = [-1.45, 0, 0.3]
        break
      case 'arrange':
        r = [-2.3 + Math.sin(t * 2) * 0.25, 0, 0.2]
        l = [-0.8, 0, -0.2]
        break
      case 'read':
        l = [-1.15, 0, -0.45]
        r = [-1.15, 0, 0.45]
        break
      case 'stroll':
        l = [-s * 0.4, 0, -0.15]
        r = [-0.6, 0, 0.2]
        break
      case 'sit':
        l = [-0.5, 0, -0.25]
        r = [-0.5, 0, 0.25]
        break
      case 'sleep':
        l = [-0.3, 0, -0.1]
        r = [-0.3, 0, 0.1]
        break
      default:
    }
    armL.current.rotation.set(...l)
    armR.current.rotation.set(...r)
    // what's in the hands
    const tool =
      p.tool ||
      { carry: 'tray', serve: 'tray', hand: 'cup', water: 'can', dig: 'trowel', plant: 'trowel', oven: 'bread', read: 'book', stroll: 'staff' }[mode] ||
      null
    for (const [name, el] of Object.entries(tools.current)) el.visible = name === tool
    if (p.cupColor) drinkMat.color.set(p.cupColor)
    zzz.current.visible = mode === 'sleep'
    if (mode === 'sleep') {
      zzz.current.position.y = 0.95 + ((t * 0.3) % 0.3)
      zzz.current.scale.setScalar(0.6 + ((t * 0.3) % 0.3))
    }
  })
  return (
    <group ref={groupRef}>
      <group ref={body}>
        {/* legs and boots */}
        {[
          [legL, -0.08],
          [legR, 0.08],
        ].map(([ref, x], i) => (
          <group key={i} ref={ref} position={[x, 0.2, 0]}>
            <C p={[0, -0.08, 0]} rt={0.045} h={0.16} c={look.pants} seg={8} />
            <S p={[0, -0.17, 0.03]} s={[0.07, 0.045, 0.09]} c={look.boots || '#7a5a4a'} />
          </group>
        ))}
        {/* round body, apron */}
        <mesh position={[0, 0.36, 0]} scale={[1, 1.05, 0.9]} material={mat(look.shirt)}>
          <sphereGeometry args={[0.2, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.33, 0.12]} scale={[0.85, 1.05, 0.5]} material={mat(look.apron)}>
          <sphereGeometry args={[0.17, 14, 10, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.6]} />
        </mesh>
        <B p={[0, 0.25, 0.19]} s={[0.1, 0.05, 0.02]} c={look.apronDark} />
        {/* arms; the right hand holds the tools */}
        <group ref={armL} position={[-0.19, 0.46, 0]}>
          <C p={[0, -0.09, 0]} rt={0.035} rb={0.03} h={0.17} c={look.shirt} seg={8} />
          <S p={[0, -0.19, 0]} s={0.04} c={look.skin} />
        </group>
        <group ref={armR} position={[0.19, 0.46, 0]}>
          <C p={[0, -0.09, 0]} rt={0.035} rb={0.03} h={0.17} c={look.shirt} seg={8} />
          <S p={[0, -0.19, 0]} s={0.04} c={look.skin} />
          <group position={[0, -0.21, 0.02]}>
            {/* a watering can */}
            <group ref={toolRef('can')} visible={false} rotation={[Math.PI / 2, 0, 0]}>
              <C p={[0, 0, 0.06]} rt={0.06} h={0.1} c="#8fc9b3" />
              <C p={[0, 0.09, 0.06]} rt={0.012} h={0.12} c="#8fc9b3" r={[0.9, 0, 0]} />
            </group>
            {/* a little trowel */}
            <group ref={toolRef('trowel')} visible={false} rotation={[Math.PI / 2, 0, 0]}>
              <C p={[0, 0.03, 0]} rt={0.012} h={0.08} c="#9a6b4a" />
              <B p={[0, 0.1, 0]} s={[0.05, 0.07, 0.01]} c="#c9c3d2" />
            </group>
            {/* a loaf of bread */}
            <group ref={toolRef('bread')} visible={false} rotation={[Math.PI / 2, 0, 0]}>
              <S p={[-0.18, 0.05, 0]} s={[0.12, 0.05, 0.06]} c="#d9a066" />
            </group>
            {/* an open book */}
            <group ref={toolRef('book')} visible={false} rotation={[Math.PI / 2, 0, 0]}>
              <B p={[-0.19, 0.03, 0]} s={[0.2, 0.01, 0.14]} c="#fff6ea" />
              <B p={[-0.19, 0.02, 0]} s={[0.21, 0.012, 0.15]} c="#b9a5e8" />
            </group>
            {/* a walking staff */}
            <group ref={toolRef('staff')} visible={false}>
              <C p={[0, 0.02, 0.02]} rt={0.016} h={0.62} c="#8a5a3c" />
              <S p={[0, 0.35, 0.02]} s={0.035} c="#c9f0e0" glow={0.6} />
            </group>
            {/* a lantern */}
            <group ref={toolRef('lantern')} visible={false}>
              <C p={[0, -0.06, 0.02]} rt={0.04} h={0.08} c="#ffd27f" glow={1.2} />
              <C p={[0, -0.005, 0.02]} rt={0.045} rb={0.02} h={0.03} c="#6d5a6e" />
            </group>
            {/* a basket */}
            <group ref={toolRef('basket')} visible={false}>
              <C p={[0, -0.07, 0.03]} rt={0.07} rb={0.055} h={0.08} c="#c8915f" />
              <S p={[0, -0.03, 0.03]} s={[0.05, 0.03, 0.05]} c="#f7a8c4" />
            </group>
            {/* a cup (handing it over) */}
            <group ref={toolRef('cup')} visible={false} position={[0, 0.04, 0.04]}>
              <C p={[0, 0, 0]} rt={0.04} rb={0.034} h={0.08} c="#fffaf2" />
              <mesh position={[0, 0.041, 0]} rotation={[-Math.PI / 2, 0, 0]} material={drinkMat}>
                <circleGeometry args={[0.036, 12]} />
              </mesh>
            </group>
          </group>
        </group>
        {/* a tray (carried in both hands), with a cup on it */}
        <group ref={toolRef('tray')} position={[0, 0.63, 0.24]} visible={false}>
          <C p={[0, 0, 0]} rt={0.17} h={0.015} c="#c8915f" />
          <C p={[0.03, 0.05, 0]} rt={0.04} rb={0.035} h={0.08} c="#fffaf2" />
          <mesh position={[0.03, 0.091, 0]} rotation={[-Math.PI / 2, 0, 0]} material={drinkMat}>
            <circleGeometry args={[0.036, 12]} />
          </mesh>
        </group>
        {/* head: face, nose, cheeks, beard, hat */}
        <group ref={head} position={[0, 0.68, 0]}>
          <S p={[0, 0, 0]} s={0.15} c={look.skin} />
          <S p={[0, -0.01, 0.14]} s={[0.05, 0.045, 0.045]} c={look.nose} />
          {[-0.07, 0.07].map((x) => (
            <group key={x}>
              <S p={[x, 0.035, 0.125]} s={0.018} c="#2a1f3d" />
              <S p={[x * 1.3, -0.02, 0.11]} s={[0.03, 0.02, 0.01]} c="#ff9cb8" />
            </group>
          ))}
          {look.glasses && (
            <group position={[0, 0.035, 0.135]}>
              {[-0.07, 0.07].map((x) => (
                <mesh key={x} position={[x, 0, 0]} material={mat('#e8c46a', 0.2)}>
                  <torusGeometry args={[0.035, 0.007, 6, 14]} />
                </mesh>
              ))}
            </group>
          )}
          {look.beard ? (
            <mesh position={[0, -0.09, 0.07]} scale={[1, look.longBeard ? 1.8 : 1.25, 0.8]} material={mat(look.beard)}>
              <sphereGeometry args={[0.11, 12, 10]} />
            </mesh>
          ) : (
            [-1, 1].map((sx) => <S key={sx} p={[sx * 0.14, -0.08, -0.02]} s={[0.045, 0.1, 0.045]} c={look.hair} />)
          )}
          {/* the hat: a tall cone with a bend at the top */}
          <mesh position={[0, 0.17, -0.01]} scale={[1, look.tallHat ? 1.35 : 1, 1]} material={mat(look.hat)}>
            <coneGeometry args={[0.16, 0.28, 14]} />
          </mesh>
          <mesh position={[0.03, look.tallHat ? 0.39 : 0.34, -0.03]} rotation={[0, 0, -0.5]} material={mat(look.hat)}>
            <coneGeometry args={[0.07, 0.16, 10]} />
          </mesh>
          <mesh position={[0, 0.06, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={mat(look.band)}>
            <torusGeometry args={[0.15, 0.022, 6, 18]} />
          </mesh>
          {look.flower && <S p={[0.1, 0.1, 0.08]} s={0.035} c={look.flower} />}
        </group>
        {/* sleeping: a little z */}
        <group ref={zzz} position={[0.2, 0.95, 0]} visible={false}>
          <S p={[0, 0, 0]} s={0.03} c="#fffaf6" glow={0.3} />
          <S p={[0.06, 0.08, 0]} s={0.022} c="#fffaf6" glow={0.3} />
          <S p={[0.1, 0.15, 0]} s={0.015} c="#fffaf6" glow={0.3} />
        </group>
      </group>
      {/* a soft shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#24143a" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A little speech bubble over a gnome. */
export function Bubble({ text, y = 1.25 }) {
  return text ? (
    <Html position={[0, y, 0]} center zIndexRange={[15, 0]} className="plant-anchor">
      <div className="gnome-bubble">{text}</div>
    </Html>
  ) : null
}
