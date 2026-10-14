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
