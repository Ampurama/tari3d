import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store'
import { atmosphere } from '../../lib/atmosphere'
import { shadowTexture } from '../../lib/textures'

/*
 * A small, stylised, fully procedural character (no model files to download or fail).
 * Appearance comes from config (`avatars` in content/config.js). It never tries to look like
 * a real person — just a little soul in the game's art style.
 *
 * Animation is procedural: idle breathing + blinking, a walk/run cycle driven by `getMotion()`,
 * and a happy "cheer" when something is found.
 */

/**
 * A soft rim of light around the silhouette (a view-facing fresnel), shared by every character:
 * warm white by day, peach at sunset, moonlit lavender at night. It keeps the little souls readable
 * against the grass and the dark, and makes them feel lit by the same sky as everything else.
 */
const rim = { uRimColor: { value: new THREE.Color('#fff1e0') }, uRimStrength: { value: 0.22 } }
const RIM_DAY = new THREE.Color('#fff1e0')
const RIM_SUNSET = new THREE.Color('#ffb98f')
const RIM_NIGHT = new THREE.Color('#b8b4ff')
let rimFrame = -1
function updateRim(frame) {
  if (frame === rimFrame) return // once per frame, however many characters are on screen
  rimFrame = frame
  const { day, sunset } = atmosphere
  rim.uRimColor.value.copy(RIM_DAY).lerp(RIM_SUNSET, sunset).lerp(RIM_NIGHT, 1 - day)
  rim.uRimStrength.value = 0.2 + sunset * 0.14 + (1 - day) * 0.32
}
function withRim(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, rim)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float facing = max(dot(normal, normalize(vViewPosition)), 0.0);
          totalEmissiveRadiance += uRimColor * pow(1.0 - facing, 3.0) * uRimStrength;
        }`,
      )
  }
  material.customProgramCacheKey = () => 'avatar-rim'
  return material
}

function useMats(look) {
  return useMemo(() => {
    const m = (color, extra = {}) => withRim(new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra }))
    return {
      // skin: soft and matte, with a whisper of its own warmth (light seems to glow through it)
      skin: m(look.skin, { roughness: 0.62, emissive: look.skin, emissiveIntensity: 0.07 }),
      // hair: a little glossier, so it catches a highlight
      hair: m(look.hair, { roughness: 0.42 }),
      // clothes: fabric, not plastic
      top: m(look.top, { roughness: 0.86 }),
      bottom: m(look.bottom, { roughness: 0.86 }),
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
  const kneeL = useRef()
  const kneeR = useRef()
  const armL = useRef()
  const armR = useRef()
  const elbowL = useRef()
  const elbowR = useRef()
  const eyes = useRef()
  const phase = useRef(0)
  const blink = useRef(2)
  const swingNow = useRef(0)
  const pose = useRef(null)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const dress = look.outfit === 'dress'
  const longHair = look.hairStyle === 'long'

  useFrame(({ clock }, delta) => {
    updateRim(clock.elapsedTime)
    const motion = getMotion?.() || { speed: 0, cheer: 0 }
    const t = clock.elapsedTime
    const speed = Math.min(motion.speed, 6)
    // the stride eases in and out instead of switching on and off
    const stride = speed > 0.15 ? Math.min(1, speed / 2.2) * (speed > 3 ? 0.95 : 0.7) : 0
    swingNow.current = THREE.MathUtils.damp(swingNow.current, stride, 9, delta)
    const swing = swingNow.current < 0.01 ? 0 : swingNow.current
    const moving = swing > 0.05
    phase.current += delta * (swing > 0 ? 4 + speed * 1.8 : 0)
    const joints = [legL.current, legR.current, kneeL.current, kneeR.current, armL.current, armR.current, elbowL.current, elbowR.current, head.current]
    // last frame's pose (joint angles, body bob and lean), to ease from
    const prev = pose.current || (pose.current = { r: joints.map(() => new THREE.Euler()), y: 0, lean: 0, first: true })
    joints.forEach((j, i) => prev.r[i].copy(j.rotation))
    prev.y = body.current.position.y
    prev.lean = body.current.rotation.x
    const s = Math.sin(phase.current)
    const c = Math.cos(phase.current)
    const aL = armL.current
    const aR = armR.current
    const eL = elbowL.current
    const eR = elbowR.current
    // legs: the thigh swings from the hip, the knee bends as that foot comes through
    legL.current.rotation.x = s * swing
    legR.current.rotation.x = -s * swing
    kneeL.current.rotation.x = swing * (0.15 + 0.85 * Math.max(0, c))
    kneeR.current.rotation.x = swing * (0.15 + 0.85 * Math.max(0, -c))
    // arms: swing opposite to the legs, hanging a little away from the body, elbows soft
    const cheer = Math.min(1, motion.cheer || 0)
    const out = dress ? 0.2 : 0.09 // a little further out over a skirt, so the hands never sink into it
    aL.rotation.set(-s * swing * 0.8 - cheer * 2.6, 0, -out - cheer * 0.3)
    aR.rotation.set(s * swing * 0.8 - cheer * 2.6, 0, out + cheer * 0.3)
    eL.rotation.set(-0.18 - swing * 0.3 * Math.max(0, s), 0, 0)
    eR.rotation.set(-0.18 - swing * 0.3 * Math.max(0, -s), 0, 0)
    // bob while walking, breathe while standing
    const breathe = reducedMotion ? 0 : Math.sin(t * 2) * 0.012
    body.current.position.y = moving ? Math.abs(c) * 0.05 * swing : breathe + cheer * Math.abs(Math.sin(t * 9)) * 0.08
    body.current.rotation.x = moving ? 0.08 * Math.min(1, speed / 3) : 0
    head.current.rotation.y = moving || reducedMotion ? 0 : Math.sin(t * 0.6) * 0.18
    head.current.rotation.z = moving || reducedMotion ? 0 : Math.sin(t * 0.9) * 0.04
    // sitting: on a chair the shins hang down; on the ground (a blanket, the porch) the legs stretch out
    if (motion.sit) {
      const ground = motion.sit === 'ground'
      legL.current.rotation.x = legR.current.rotation.x = -1.45
      kneeL.current.rotation.x = kneeR.current.rotation.x = ground ? 0.08 : 1.4
      // hands resting on the lap
      aL.rotation.set(-0.3, 0, -0.12)
      aR.rotation.set(-0.3, 0, 0.12)
      eL.rotation.set(-1.0, 0, 0)
      eR.rotation.set(-1.0, 0, 0)
      body.current.position.y = breathe
      body.current.rotation.x = 0
    }
    // holding hands: the arm reaches down and a little forward, so the two hands meet halfway between
    // you (characters stand HAND_OFFSET = 0.55 apart, shoulders 0.2 out, hand 0.28 from the shoulder)
    if (motion.hand === 'right' || motion.hand === 'left') {
      const right = motion.hand === 'right'
      const arm = right ? aR : aL
      arm.rotation.set(-0.47, 0, right ? 0.27 : -0.27)
      ;(right ? eR : eL).rotation.set(-0.05, 0, 0)
      // no bobbing and no lean while holding hands: both bodies stay level, so the hands stay together
      body.current.position.y = breathe
      body.current.rotation.x = 0
    }
    // little gestures (all procedural: a few joint angles over a couple of seconds)
    const e = motion.emote
    if (e) {
      const et = performance.now() / 1000 - e.t0
      const wig = reducedMotion ? 0 : Math.sin(et * 11)
      const k = Math.min(1, et * 4)
      if (e.kind === 'wave' || e.kind === 'call') {
        // the hand up, waving from the elbow
        aR.rotation.set(-2.6 * k, 0, 0.3)
        eR.rotation.set(-0.35 * k, 0, wig * 0.55 * k)
        if (e.kind === 'call') {
          // the other hand cupped by the mouth
          aL.rotation.set(-1.15 * k, 0, -0.25)
          eL.rotation.set(-1.95 * k, 0, 0)
        }
      } else if (e.kind === 'heart') {
        // both arms up, the forearms curving in over the head: a heart
        aL.rotation.set(-2.7 * k, 0, -0.4 * k)
        aR.rotation.set(-2.7 * k, 0, 0.4 * k)
        eL.rotation.set(0, 0, 1.15 * k)
        eR.rotation.set(0, 0, -1.15 * k)
      } else if (e.kind === 'happy') {
        aL.rotation.set(-2.5 * k, 0, -0.45)
        aR.rotation.set(-2.5 * k, 0, 0.45)
        eL.rotation.set(0, 0, 0)
        eR.rotation.set(0, 0, 0)
        if (!motion.sit && !reducedMotion) body.current.position.y = Math.abs(Math.sin(et * 9)) * 0.12
      } else if (e.kind === 'photo') {
        // a peace sign by the cheek, head tilted toward it
        aR.rotation.set(-1.3 * k, 0, 0.4 * k)
        eR.rotation.set(-1.75 * k, 0, 0)
        head.current.rotation.z = -0.18 * k
        head.current.rotation.y = 0
      }
    }
    // ease every joint from where it was toward this frame's pose: starting and stopping, sitting
    // down, reaching for a hand or a wave all blend instead of snapping (quick enough to keep
    // the walk crisp and the held hands together)
    if (!prev.first) {
      const k = 1 - Math.exp(-(swing > 0.3 ? 30 : 16) * delta)
      joints.forEach((j, i) => {
        const p = prev.r[i]
        j.rotation.set(p.x + (j.rotation.x - p.x) * k, p.y + (j.rotation.y - p.y) * k, p.z + (j.rotation.z - p.z) * k)
      })
      body.current.position.y = prev.y + (body.current.position.y - prev.y) * k
      body.current.rotation.x = prev.lean + (body.current.rotation.x - prev.lean) * k
    }
    prev.first = false
    // blink every few seconds
    blink.current -= delta
    const closed = blink.current < 0.12
    eyes.current.scale.y = closed ? 0.15 : 1
    if (blink.current < 0) blink.current = 2.5 + ((t * 7.3) % 3)
  })

  return (
    <group ref={ref} {...props}>
      <group ref={body}>
        {/* legs: thigh (pivot at the hip), shin and shoe (pivot at the knee) */}
        {[
          [legL, kneeL, -0.09],
          [legR, kneeR, 0.09],
        ].map(([hip, knee, x], i) => (
          <group key={i} ref={hip} position={[x, 0.38, 0]}>
            <mesh position={[0, -0.085, 0]} material={mats.bottom} castShadow={castShadow}>
              <capsuleGeometry args={[0.064, 0.1, 4, 10]} />
            </mesh>
            <group ref={knee} position={[0, -0.17, 0]}>
              <mesh position={[0, -0.07, 0]} material={dress ? mats.skin : mats.bottom} castShadow={castShadow}>
                <capsuleGeometry args={[dress ? 0.042 : 0.056, 0.08, 4, 10]} />
              </mesh>
              <mesh position={[0, -0.165, 0.03]} scale={[1, 0.68, 1.4]} material={mats.shoes} castShadow={castShadow}>
                <sphereGeometry args={[0.072, 12, 10]} />
              </mesh>
            </group>
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

        {/* a neck, and rounded shoulders */}
        <mesh position={[0, 0.77, 0]} material={mats.skin}>
          <cylinderGeometry args={[0.05, 0.06, 0.1, 10]} />
        </mesh>
        {[-0.17, 0.17].map((x) => (
          <mesh key={x} position={[x, 0.67, 0]} material={mats.top} castShadow={castShadow}>
            <sphereGeometry args={[0.068, 12, 10]} />
          </mesh>
        ))}

        {/* arms: upper arm (pivot at the shoulder), forearm and hand (pivot at the elbow) */}
        {[
          [armL, elbowL, -0.2, -1],
          [armR, elbowR, 0.2, 1],
        ].map(([shoulder, elbow, x, side], i) => (
          <group key={i} ref={shoulder} position={[x, 0.66, 0]}>
            <mesh position={[0, -0.07, 0]} material={mats.top} castShadow={castShadow}>
              <capsuleGeometry args={[0.048, 0.07, 4, 10]} />
            </mesh>
            <group ref={elbow} position={[0, -0.15, 0]}>
              <mesh position={[0, -0.055, 0]} material={mats.skin} castShadow={castShadow}>
                <capsuleGeometry args={[0.04, 0.06, 4, 10]} />
              </mesh>
              {/* the hand: a soft palm with a little thumb on the front */}
              <group position={[0, -0.13, 0]}>
                <mesh scale={[0.85, 1.15, 0.62]} material={mats.skin}>
                  <sphereGeometry args={[0.046, 12, 10]} />
                </mesh>
                <mesh position={[-side * 0.022, 0.012, 0.026]} scale={[0.8, 1.2, 0.8]} material={mats.skin}>
                  <sphereGeometry args={[0.017, 8, 6]} />
                </mesh>
              </group>
            </group>
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
      {/* soft contact shadow, darkest right under the feet, so she's always standing on something */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} renderOrder={2}>
        <planeGeometry args={[0.72, 0.72]} />
        <meshBasicMaterial color="#24143a" alphaMap={shadowTexture()} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  )
})

export default Avatar
