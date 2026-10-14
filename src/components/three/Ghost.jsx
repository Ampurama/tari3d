import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { avatars } from '../../content/config'
import { partner } from '../../lib/couple'
import { currentAvatar, useStore } from '../../store'
import Avatar from './Avatar'

/*
 * The one who's far away, as a soft glowing figure: their own character, drawn in light
 * (bright at the edges, almost clear in the middle). Used on the dreamed beach, and on the seat
 * next to her when she sits alone.
 */

function makeGhostMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ffd9ec') } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
        float a = (0.16 + rim * 0.95) * uOpacity;
        gl_FragColor = vec4(uColor * (0.55 + rim * 0.9), a);
      }`,
  })
}

/** The other person's avatar (the one they chose, or the other one). */
export function useMateAvatar() {
  const mine = useStore(currentAvatar)
  return useMemo(() => avatars.find((a) => a.id === partner.avatarId) || avatars.find((a) => a.id !== mine?.id) || avatars[0], [mine])
}

/**
 * A glowing figure. `getOpacity()` (0..1) and `getMotion()` are read every frame,
 * so it can fade in and move without re-rendering.
 */
export default function Ghost({ config, getOpacity, getMotion, ...props }) {
  const group = useRef()
  const material = useMemo(makeGhostMaterial, [])
  useFrame(() => {
    const g = group.current
    if (!g) return
    const o = getOpacity()
    material.uniforms.uOpacity.value = o
    g.visible = o > 0.01
    if (!g.visible) return
    // draw every part in light (the soft contact shadow under the feet stays as it is)
    g.traverse((m) => {
      if (m.isMesh && m.material !== material && m.geometry.type !== 'CircleGeometry') m.material = material
    })
  })
  return <Avatar ref={group} config={config} getMotion={getMotion} castShadow={false} {...props} />
}
