import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'

/*
 * A small, stylised, fully procedural character (no model files to download or fail).
 * Appearance comes from config (`avatars` in content/config.js). It never tries to look like
 * a real person — just a little soul in the game's art style.
 *
 * Animation is procedural: idle breathing + blinking, a walk/run cycle driven by `getMotion()`,
 * and a happy "cheer" when something is found.
 */

function useMats(look) {
  return useMemo(() => {
    const m = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra })
    return {
      skin: m(look.skin),
      hair: m(look.hair, { roughness: 0.5 }),
      top: m(look.top),
      bottom: m(look.bottom),
      shoes: m(look.shoes, { roughness: 0.5 }),
      accent: m(look.accent, { emissive: look.accent, emissiveIntensity: 0.25 }),
      eye: new THREE.MeshBasicMaterial({ color: '#2a1f3d' }),
      blush: new THREE.MeshBasicMaterial({ color: '#ff9cb8', transparent: true, opacity: 0.55, depthWrite: false }),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    }
  }, [look.skin, look.hair, look.top, look.bottom, look.shoes, look.accent])
}

const Avatar = forwardRef(function Avatar({ config, getMotion, castShadow = true, ...props }, ref) {
  const look = config.look
  const mats = useMats(look)
  const body = useRef()
  const head = useRef()
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const eyes = useRef()
  const phase = useRef(0)
  const blink = useRef(2)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const dress = look.outfit === 'dress'
  const longHair = look.hairStyle === 'long'

  useFrame(({ clock }, delta) => {
    const motion = getMotion?.() || { speed: 0, cheer: 0 }
    const t = clock.elapsedTime
    const speed = Math.min(motion.speed, 6)
    const moving = speed > 0.15
    phase.current += delta * (moving ? 4 + speed * 1.8 : 0)
    const swing = moving ? Math.min(1, speed / 2.2) * (speed > 3 ? 0.95 : 0.7) : 0
    const s = Math.sin(phase.current)
    legL.current.rotation.x = s * swing
    legR.current.rotation.x = -s * swing
    const cheer = Math.min(1, motion.cheer || 0)
    armL.current.rotation.x = -s * swing * 0.9 - cheer * 2.6
    armR.current.rotation.x = s * swing * 0.9 - cheer * 2.6
    armL.current.rotation.z = 0.12 + cheer * 0.3
    armR.current.rotation.z = -0.12 - cheer * 0.3
    // bob while walking, breathe while standing
    const breathe = reducedMotion ? 0 : Math.sin(t * 2) * 0.012
    body.current.position.y = moving ? Math.abs(Math.cos(phase.current)) * 0.05 * swing : breathe + cheer * Math.abs(Math.sin(t * 9)) * 0.08
    body.current.rotation.x = moving ? 0.08 * Math.min(1, speed / 3) : 0
    head.current.rotation.y = moving || reducedMotion ? 0 : Math.sin(t * 0.6) * 0.18
    head.current.rotation.z = moving || reducedMotion ? 0 : Math.sin(t * 0.9) * 0.04
    // sitting: legs forward, hands resting on the lap
    if (motion.sit) {
      legL.current.rotation.x = legR.current.rotation.x = -1.45
      armL.current.rotation.x = armR.current.rotation.x = -0.55
      armL.current.rotation.z = 0.2
      armR.current.rotation.z = -0.2
      body.current.position.y = breathe
      body.current.rotation.x = 0
    }
    // holding hands: the leader's right hand and the follower's left reach out to each other
    if (motion.hand === 'right') {
      armR.current.rotation.x = -0.25 - s * swing * 0.3
      armR.current.rotation.z = -0.62
    } else if (motion.hand === 'left') {
      armL.current.rotation.x = -0.25 + s * swing * 0.3
      armL.current.rotation.z = 0.62
    }
    // little gestures (all procedural: a few joint angles over a couple of seconds)
    const e = motion.emote
    if (e) {
      const et = performance.now() / 1000 - e.t0
      const wig = reducedMotion ? 0 : Math.sin(et * 11)
      const k = Math.min(1, et * 4)
      if (e.kind === 'wave' || e.kind === 'call') {
        armR.current.rotation.x = -2.7 * k
        armR.current.rotation.z = -0.35 + wig * 0.35
        if (e.kind === 'call') {
          armL.current.rotation.x = -2.0 * k
          armL.current.rotation.z = 0.5
        }
      } else if (e.kind === 'heart') {
        // both hands above the head, curved into a heart
        armL.current.rotation.x = armR.current.rotation.x = -2.85 * k
        armL.current.rotation.z = -0.55 * k
        armR.current.rotation.z = 0.55 * k
      } else if (e.kind === 'happy') {
        armL.current.rotation.x = armR.current.rotation.x = -2.5 * k
        armL.current.rotation.z = 0.4
        armR.current.rotation.z = -0.4
        if (!motion.sit && !reducedMotion) body.current.position.y = Math.abs(Math.sin(et * 9)) * 0.12
      } else if (e.kind === 'photo') {
        // a peace sign by the face, head tilted
        armR.current.rotation.x = -2.3 * k
        armR.current.rotation.z = -0.9 * k
        armL.current.rotation.z = 0.35
        head.current.rotation.z = 0.18 * k
        head.current.rotation.y = 0
      }
    }
    // blink every few seconds
    blink.current -= delta
    const closed = blink.current < 0.12
    eyes.current.scale.y = closed ? 0.15 : 1
    if (blink.current < 0) blink.current = 2.5 + ((t * 7.3) % 3)
  })

  return (
    <group ref={ref} {...props}>
      <group ref={body}>
        {/* legs (pivot at the hip) */}
        {[
          [legL, -0.09],
          [legR, 0.09],
        ].map(([r, x], i) => (
          <group key={i} ref={r} position={[x, 0.38, 0]}>
            <mesh position={[0, -0.17, 0]} material={mats.bottom} castShadow={castShadow}>
              <capsuleGeometry args={[0.065, 0.2, 4, 10]} />
            </mesh>
            <mesh position={[0, -0.34, 0.03]} scale={[1, 0.7, 1.35]} material={mats.shoes} castShadow={castShadow}>
              <sphereGeometry args={[0.075, 12, 10]} />
            </mesh>
          </group>
        ))}

        {/* torso / outfit */}
        {dress ? (
          <mesh position={[0, 0.5, 0]} material={mats.top} castShadow={castShadow}>
            <cylinderGeometry args={[0.13, 0.26, 0.42, 20]} />
          </mesh>
        ) : (
          <>
            <mesh position={[0, 0.56, 0]} material={mats.top} castShadow={castShadow}>
              <capsuleGeometry args={[0.15, 0.2, 6, 14]} />
            </mesh>
            <mesh position={[0, 0.4, 0]} material={mats.bottom} castShadow={castShadow}>
              <cylinderGeometry args={[0.155, 0.16, 0.1, 16]} />
            </mesh>
          </>
        )}

        {/* arms (pivot at the shoulder) */}
        {[
          [armL, -0.2],
          [armR, 0.2],
        ].map(([r, x], i) => (
          <group key={i} ref={r} position={[x, 0.66, 0]}>
            <mesh position={[0, -0.13, 0]} material={mats.top} castShadow={castShadow}>
              <capsuleGeometry args={[0.05, 0.16, 4, 10]} />
            </mesh>
            <mesh position={[0, -0.27, 0]} material={mats.skin}>
              <sphereGeometry args={[0.05, 10, 8]} />
            </mesh>
          </group>
        ))}

        {/* accessory */}
        {look.accessory === 'scarf' && (
          <mesh position={[0, 0.74, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.accent}>
            <torusGeometry args={[0.12, 0.04, 8, 20]} />
          </mesh>
        )}

        {/* head */}
        <group ref={head} position={[0, 0.98, 0]}>
          <mesh material={mats.skin} castShadow={castShadow}>
            <sphereGeometry args={[0.24, 24, 20]} />
          </mesh>
          {/* hair cap + fringe */}
          <mesh position={[0, 0.06, -0.02]} scale={[1.06, 0.95, 1.06]} material={mats.hair}>
            <sphereGeometry args={[0.245, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          </mesh>
          <mesh position={[0, 0.11, 0.17]} rotation={[0.9, 0, 0]} scale={[1, 0.45, 0.6]} material={mats.hair}>
            <sphereGeometry args={[0.17, 16, 10]} />
          </mesh>
          {longHair ? (
            <>
              <mesh position={[0, -0.12, -0.12]} scale={[1, 1.4, 0.7]} material={mats.hair} castShadow={castShadow}>
                <sphereGeometry args={[0.22, 18, 14]} />
              </mesh>
              {look.accessory === 'bow' && (
                <group position={[0.14, 0.2, -0.06]} rotation={[0, 0, 0.4]}>
                  {[-1, 1].map((sx) => (
                    <mesh key={sx} position={[sx * 0.05, 0, 0]} rotation={[0, 0, sx * Math.PI / 2]} material={mats.accent}>
                      <coneGeometry args={[0.045, 0.08, 10]} />
                    </mesh>
                  ))}
                </group>
              )}
            </>
          ) : (
            <mesh position={[0.02, 0.24, -0.02]} rotation={[0, 0, -0.5]} material={mats.hair}>
              <coneGeometry args={[0.04, 0.12, 8]} />
            </mesh>
          )}
          {/* face */}
          <group ref={eyes} position={[0, 0.01, 0.215]}>
            {[-0.075, 0.075].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                <mesh material={mats.eye} scale={[1, 1.3, 0.5]}>
                  <sphereGeometry args={[0.032, 10, 8]} />
                </mesh>
                <mesh material={mats.shine} position={[0.01, 0.015, 0.012]}>
                  <sphereGeometry args={[0.009, 6, 6]} />
                </mesh>
              </group>
            ))}
          </group>
          {[-0.13, 0.13].map((x) => (
            <mesh key={x} position={[x, -0.05, 0.195]} rotation={[0, x * 2.5, 0]} material={mats.blush}>
              <circleGeometry args={[0.035, 14]} />
            </mesh>
          ))}
          <mesh position={[0, -0.075, 0.228]} rotation={[0, 0, Math.PI]} material={mats.eye}>
            <torusGeometry args={[0.025, 0.006, 6, 12, Math.PI]} />
          </mesh>
        </group>
      </group>
      {/* soft contact shadow so it never looks like it's floating */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.24, 20]} />
        <meshBasicMaterial color="#1a1030" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  )
})

export default Avatar
