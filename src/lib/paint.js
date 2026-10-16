/*
 * PAINTED SURFACES — cheap procedural texture for the low-poly island (no image downloads).
 * A material is patched (onBeforeCompile, chained with any patch it already has, e.g. the wind)
 * so its colour is broken up by a couple of octaves of value noise in world space:
 *   'foliage' → leafy clumps, lighter tips, darker pockets
 *   'rock'    → speckles and soft streaks
 *   'earth'   → horizontal strata (the layered soil under the island)
 * Two or three noise lookups per pixel: a few percent of a frame, even on phones.
 */

export const NOISE_GLSL = /* glsl */ `
float pHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float pNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pHash(i), pHash(i + vec3(1, 0, 0)), u.x), mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), u.x), mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}`

const BODY = {
  foliage: /* glsl */ `
    {
      float clumps = pNoise(vPaint * 3.2);
      float leaves = pNoise(vPaint * 9.0);
      diffuseColor.rgb *= 0.82 + clumps * 0.26 + (leaves - 0.5) * 0.14;
      diffuseColor.rgb += vec3(0.05, 0.06, 0.0) * smoothstep(0.62, 0.9, leaves);
    }`,
  rock: /* glsl */ `
    {
      float speck = pNoise(vPaint * 11.0);
      float streak = pNoise(vec3(vPaint.x * 2.0, vPaint.y * 7.0, vPaint.z * 2.0));
      diffuseColor.rgb *= 0.86 + streak * 0.16 + (speck - 0.5) * 0.12;
    }`,
  earth: /* glsl */ `
    {
      float wobble = pNoise(vPaint * 0.8) * 0.6;
      float band = sin((vPaint.y + wobble) * 5.5) * 0.5 + 0.5;
      float grain = pNoise(vPaint * 6.0);
      diffuseColor.rgb *= 0.84 + band * 0.14 + (grain - 0.5) * 0.12;
    }`,
}

/** Give a MeshStandardMaterial a painted, textured look. Returns the same material. */
export function withPaint(material, kind) {
  const prev = material.onBeforeCompile
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaint;').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec4 pw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          pw = instanceMatrix * pw;
        #endif
        vPaint = (modelMatrix * pw).xyz;
      }`,
    )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPaint;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${BODY[kind]}`)
  }
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|paint-${kind}`
  return material
}

/**
 * Ground relief for a large ground mesh (the main meadow, the wide meadow): soft clumps of grass and
 * a fine grain, as a procedural bump that catches the light (long morning and evening shadows show
 * it off), with the colour following the same clumps (lush tops, darker hollows, a few dry, golden
 * patches). Fades out with distance so it never shimmers. Chains with any existing patch.
 */
export function withGroundDetail(material) {
  const prev = material.onBeforeCompile
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRelief;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvRelief = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRelief;
        float rHash(vec2 p) { return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453); }
        float rNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), u.x), mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float rRelief(vec2 p) { return rNoise(p * 1.4) * 0.65 + rNoise(p * 4.3) * 0.25 + rNoise(p * 11.0) * 0.1; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float near = 1.0 - smoothstep(35.0, 110.0, length(cameraPosition - vRelief));
          float clump = rRelief(vRelief.xz);
          float grassy = smoothstep(0.02, 0.12, diffuseColor.g - diffuseColor.r);
          // hollows a little deeper, clump tops a little brighter
          diffuseColor.rgb *= mix(1.0, 0.86 + clump * 0.26, grassy * (0.4 + 0.6 * near));
          // a few dry, golden patches in the green
          float dry = smoothstep(0.62, 0.8, rNoise(vRelief.xz * 0.11 + 7.3));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.04, 0.72), dry * grassy * 0.55);
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float near = 1.0 - smoothstep(30.0, 90.0, length(cameraPosition - vRelief));
          if (near > 0.0) {
            const float e = 0.06;
            vec2 q = vRelief.xz;
            vec2 grad = vec2(rRelief(q + vec2(e, 0.0)) - rRelief(q - vec2(e, 0.0)), rRelief(q + vec2(0.0, e)) - rRelief(q - vec2(0.0, e))) / (2.0 * e);
            vec3 bump = vec3(-grad.x, 0.0, -grad.y) * 0.22 * near;
            normal = normalize(normal + (viewMatrix * vec4(bump, 0.0)).xyz);
          }
        }`,
      )
  }
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|ground-detail`
  return material
}
