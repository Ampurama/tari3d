import { useEffect, useRef } from 'react'
import { player, walkTo } from './player'

/*
 * Proximity interactions. Objects register themselves with a world position, a reach radius,
 * a label for the prompt and what happens on interact. The player controller finds the nearest
 * one each frame and the HUD shows "E / ✦ <label>".
 *
 * Tapping an object from far away walks the avatar there first (tap-to-walk), then interacts.
 */
export const interactables = new Map()

/**
 * Register an interactable while the component is mounted.
 * `def`: { position: Vector3 (world), radius, label, enabled?: () => bool, onInteract: () => void, priority? }
 * The latest def is always used (no stale closures).
 */
export function useInteractable(id, def) {
  const ref = useRef(def)
  ref.current = def
  useEffect(() => {
    const proxy = {
      get position() {
        return ref.current.position
      },
      get radius() {
        return ref.current.radius ?? 1.6
      },
      get label() {
        return typeof ref.current.label === 'function' ? ref.current.label() : ref.current.label
      },
      get priority() {
        return ref.current.priority ?? 0
      },
      /** seconds the interact button must be held (0 = a simple press) */
      get hold() {
        const h = ref.current.hold
        return (typeof h === 'function' ? h() : h) || 0
      },
      enabled: () => (ref.current.enabled ? ref.current.enabled() : true),
      onInteract: () => ref.current.onInteract?.(),
    }
    interactables.set(id, proxy)
    return () => interactables.delete(id)
  }, [id])
}

/** Nearest enabled interactable within reach of the player, or null. */
export function nearestInteractable() {
  let best = null
  let bestScore = Infinity
  const p = player.position
  for (const [id, it] of interactables) {
    if (!it.enabled()) continue
    const pos = it.position
    const d = Math.hypot(pos.x - p.x, pos.z - p.z)
    if (d > it.radius) continue
    const score = d - it.priority
    if (score < bestScore) {
      bestScore = score
      best = { id, it }
    }
  }
  return best
}

/** Interact with the one in reach (keyboard E / the on-screen button). */
export function interactNearest() {
  const n = nearestInteractable()
  if (n && !(n.it.hold > 0)) n.it.onInteract()
  return Boolean(n && !(n.it.hold > 0))
}

/** Progress of the current hold interaction (0..1), shared with the HUD. */
export const holdState = { id: null, t: 0, need: 0 }

/**
 * Tap on something in the world: if it's in reach, use it now; otherwise walk over and use it on arrival.
 * Returns immediately either way.
 */
export function approach(id) {
  const it = interactables.get(id)
  if (!it || !it.enabled()) return false
  const p = player.position
  const pos = it.position
  const near = Math.hypot(pos.x - p.x, pos.z - p.z) <= it.radius
  // "hold to…" things are never completed by a single tap: walk there and let her hold
  if (it.hold > 0) {
    if (!near) walkTo(pos.x, pos.z, Math.max(0.6, it.radius * 0.7))
    player.onArrive = null
    return true
  }
  if (near) {
    it.onInteract()
    return true
  }
  if (!walkTo(pos.x, pos.z, Math.max(0.6, it.radius * 0.7))) return false
  player.onArrive = () => {
    const again = interactables.get(id)
    if (again && again.enabled() && !(again.hold > 0)) again.onInteract()
  }
  return true
}
