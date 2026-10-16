import * as THREE from 'three'
import { atmosphere } from './atmosphere'

/*
 * WATER — one shader for every body of water: the river, the pond, Reflection Lake, the western lake.
 *
 *   • a surface that moves: three octaves of procedural ripple normals drifting at different speeds
 *     (the river's flow downstream, the still waters only shivering)
 *   • it mirrors the sky of the hour (lavender by day, gold and pink at sunset, deep blue at night)
 *     with a fresnel, so it's clearer looking down and more mirror-like at a glance
 *   • the sun's glint (and the moon's, at night) where the light really is, broken up by the ripples
 *   • deep colour in the middle, shallow toward the banks, and foam that breaks up naturally
 *   • it fades into the fog of distance like the land does
 * No textures, no reflection render: a handful of noise lookups per pixel.
 */

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uDay;
  uniform float uSunset;
  uniform vec3 uLight;
  uniform float uRound;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform vec2 uFlow;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform float uEdgeFade;
  uniform vec2 uPathFrom;
  uniform vec2 uPathDir;
  uniform float uPath;
  varying vec2 vUv;
  varying vec3 vWorld;

  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  vec2 wGrad(vec2 p) {
    const float e = 0.07;
    return vec2(wNoise(p + vec2(e, 0.0)) - wNoise(p - vec2(e, 0.0)), wNoise(p + vec2(0.0, e)) - wNoise(p - vec2(0.0, e))) / (2.0 * e);
  }

  void main() {
    // still water works in world space; a river in its own space (across × along), so it flows downstream
    vec2 p = uRound > 0.5 ? vWorld.xz : vec2(vUv.x * 2.8, vUv.y);
    float t = uTime;
    // the surface: three octaves of ripples, carried along by the flow (still water just shivers)
    vec2 drift = uFlow * t;
    vec2 g = wGrad(p * 0.9 - drift * 0.6 + vec2(t * 0.05, t * 0.04)) * 0.55
           + wGrad(p * 2.3 - drift + vec2(-t * 0.11, t * 0.09)) * 0.3
           + wGrad(p * 5.7 - drift * 1.6 + vec2(t * 0.2, -t * 0.17)) * 0.15;
    vec3 n = normalize(vec3(-g.x * 0.32, 1.0, -g.y * 0.32));

    vec3 v = normalize(cameraPosition - vWorld);
    float facing = max(dot(n, v), 0.0);
    float fres = 0.18 + 0.82 * pow(1.0 - facing, 3.0);

    // how far toward the banks (0 in the middle, 1 at the edge)
    float edge = uRound > 0.5 ? length(p - uCenter) / uRadius : abs(vUv.x - 0.5) * 2.0;

    // the water's own colour: deep in the middle, shallow and clear toward the banks
    float night = 1.0 - uDay;
    vec3 deep = mix(uDeep, vec3(0.02, 0.06, 0.16), night);
    vec3 shallow = mix(uShallow, vec3(0.07, 0.16, 0.3), night);
    vec3 body = mix(deep, shallow, smoothstep(0.25, 1.0, edge));
    body *= 0.92 + 0.16 * wNoise(p * 0.6 + t * 0.03);

    // the sky it mirrors, for the hour
    vec3 r = reflect(-v, n);
    float up = clamp(r.y, 0.0, 1.0);
    vec3 skyHorizon = mix(mix(vec3(0.9, 0.85, 1.0), vec3(1.0, 0.74, 0.62), uSunset), vec3(0.12, 0.15, 0.36), night);
    vec3 skyTop = mix(mix(vec3(0.52, 0.6, 0.98), vec3(0.62, 0.52, 0.86), uSunset), vec3(0.03, 0.05, 0.16), night);
    vec3 sky = mix(skyHorizon, skyTop, pow(up, 0.6));
    vec3 col = mix(body, sky, fres * 0.75);

    // the glint of the sun (the moon at night) on the ripples
    float sun = max(dot(r, normalize(uLight)), 0.0);
    vec3 glintCol = mix(mix(vec3(1.0, 0.96, 0.86), vec3(1.0, 0.78, 0.55), uSunset), vec3(0.85, 0.9, 1.0), night);
    col += glintCol * (pow(sun, 220.0) * 2.2 + pow(sun, 28.0) * 0.18) * mix(1.0, 0.7, night);
    // little sparkles dancing where the light catches
    float sparkle = step(0.86, wNoise(p * 9.0 + vec2(t * 0.7, -t * 0.5))) * pow(sun, 6.0);
    col += glintCol * sparkle * 0.6 * (uDay * 0.8 + 0.2);

    // a path of moonlight (on the western lake, from the pier toward the moon)
    if (uPath > 0.0) {
      vec2 rel = p - uPathFrom;
      float ahead = dot(rel, uPathDir);
      float off = abs(rel.x * uPathDir.y - rel.y * uPathDir.x);
      float width = 0.5 + max(ahead, 0.0) * 0.12;
      float path = smoothstep(width, 0.0, off) * smoothstep(-2.0, 2.0, ahead) * (0.5 + 0.5 * wNoise(p * 3.0 + vec2(t * 0.6, t * 0.2)));
      col += vec3(0.95, 0.93, 0.8) * path * night * uPath * 0.6;
    }

    // foam where it meets the banks, broken up and moving
    float foamNoise = wNoise(p * 3.2 + vec2(t * 0.35, -t * 0.25)) - 0.5;
    float foam = smoothstep(0.8, 0.97, edge + foamNoise * 0.14);
    col = mix(col, mix(vec3(0.97, 1.0, 1.0), vec3(0.5, 0.56, 0.72), night), foam * 0.6);

    float alpha = mix(0.82, 0.97, fres);
    // optionally fade out at the very edge (a sheet of water that has no bank of its own)
    alpha *= 1.0 - uEdgeFade * smoothstep(0.86, 1.0, edge);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }
`

/**
 * A water material. `shape`: 'round' (a pond or a lake: edges by distance from `center`) or 'ribbon'
 * (a river: edges across its width in uv.x, uv.y running downstream; `flow` = [0, speed]). Updates itself from the time of day
 * when `tick(delta)` is called once a frame.
 */
export function createWater({ shape = 'round', center = [0, 0], radius = 1, flow = [0, 0], deep = '#138f9e', shallow = '#64d8cf', edgeFade = 0, path = null } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDay: { value: 1 },
        uSunset: { value: 0 },
        uLight: { value: new THREE.Vector3(0.5, 0.7, 0.5) },
        uRound: { value: shape === 'round' ? 1 : 0 },
        uCenter: { value: new THREE.Vector2(center[0], center[1]) },
        uRadius: { value: radius },
        uFlow: { value: new THREE.Vector2(flow[0], flow[1]) },
        uDeep: { value: new THREE.Color(deep) },
        uShallow: { value: new THREE.Color(shallow) },
        uEdgeFade: { value: edgeFade },
        uPathFrom: { value: new THREE.Vector2(...(path?.from || [0, 0])) },
        uPathDir: { value: new THREE.Vector2(...(path?.dir || [0, -1])).normalize() },
        uPath: { value: path ? 1 : 0 },
      },
    ]),
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    fog: true,
  })
  material.tick = (delta, slow = false) => {
    const u = material.uniforms
    u.uTime.value += delta * (slow ? 0.25 : 1)
    u.uDay.value = atmosphere.day
    u.uSunset.value = atmosphere.sunset
    u.uLight.value.copy(atmosphere.sunDir)
  }
  return material
}
