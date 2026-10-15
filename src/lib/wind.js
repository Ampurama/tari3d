import * as THREE from 'three'

/*
 * One shared wind clock for every swaying thing (grass, flowers, leaves).
 * Materials are patched with onBeforeCompile so instancing keeps working and
 * there's a single uniform update per frame for the whole island.
 */
export const wind = { uTime: { value: 0 }, uStrength: { value: 1 } }

/**
 * A MeshStandardMaterial that sways with the wind.
 * `bendFrom`: local height where bending starts; `amount`: sway at 1 unit above that.
 */
export function windMaterial({ bendFrom = 0, amount = 0.12, litBothSides = false, ...params } = {}) {
  const m = new THREE.MeshStandardMaterial(params)
  m.onBeforeCompile = (shader) => {
    // thin double-sided things (grass blades) with upward normals: light both faces the same way,
    // like the ground they grow from, instead of turning the back of every blade dark grey
    if (litBothSides)
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );')
    shader.uniforms.uWindTime = wind.uTime
    shader.uniforms.uWindStrength = wind.uStrength
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindTime;
        uniform float uWindStrength;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wpos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 wpos = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
          #endif
          float bend = max(0.0, position.y - ${bendFrom.toFixed(3)});
          float k = bend * bend * ${amount.toFixed(3)} * uWindStrength;
          float t = uWindTime;
          transformed.x += (sin(t * 1.7 + wpos.x * 0.55 + wpos.z * 0.35) + 0.4 * sin(t * 3.1 + wpos.z)) * k;
          transformed.z += (cos(t * 1.3 + wpos.z * 0.5) * 0.7) * k;
        }`,
      )
  }
  // keep a distinct program per bend setting
  m.customProgramCacheKey = () => `wind-${bendFrom}-${amount}-${litBothSides}`
  return m
}
