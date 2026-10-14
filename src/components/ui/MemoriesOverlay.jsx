import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { memories } from '../../content/config'
import { useStore } from '../../store'

function Photo({ src, type, alt, className, full = false }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (failed) {
    return (
      <div className={`${className} photo-fallback`} role="img" aria-label={alt}>
        <span>♡</span>
      </div>
    )
  }
  if (type === 'video') {
    return full ? (
      <video
        src={src}
        className={className}
        aria-label={alt}
        autoPlay
        muted
        loop
        playsInline
        controls
        onError={() => setFailed(true)}
      />
    ) : (
      // thumbnail: just the first frame
      <video src={`${src}#t=0.1`} className={className} muted playsInline preload="metadata" aria-hidden="true" onError={() => setFailed(true)} />
    )
  }
  // thumbnails load only when scrolled into view, so a big album stays light
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} draggable={false} loading={full ? 'eager' : 'lazy'} decoding="async" />
}

/** Gallery UI: a thumbnail strip + a lightbox that opens when a frame is chosen. */
export default function MemoriesOverlay({ flat = false }) {
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selectedMemory)
  const selectMemory = useStore((s) => s.selectMemory)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const [lightbox, setLightbox] = useState(null)
  const [dir, setDir] = useState(1)
  const open = view === 'memories'

  // wait for the camera to glide up to the frame before the photo blooms open
  useEffect(() => {
    if (!open || selected === null) {
      setLightbox(null)
      return
    }
    const t = setTimeout(() => setLightbox(selected), flat || reducedMotion ? 0 : lightbox === null ? 650 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, flat, reducedMotion])

  const step = (delta) => {
    setDir(delta)
    selectMemory((selected + delta + memories.length) % memories.length)
  }

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'Escape') selectMemory(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const memory = lightbox !== null ? memories[lightbox] : null

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`memories-ui${flat ? ' is-flat' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="section-heading">
              <h2>Our memories</h2>
              <p>
                {flat ? 'Tap a photo to look closer' : 'Tap a photo in the ring — or any photo below'}
                {memories.length > 1 && <span className="memory-count"> · {memories.length} memories</span>}
              </p>
            </div>
            <div className={flat || memories.length > 12 ? 'thumb-grid' : 'thumb-strip'} role="list">
              {memories.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  role="listitem"
                  className={`thumb${selected === i ? ' is-active' : ''}`}
                  onClick={() => {
                    setDir(i > (selected ?? -1) ? 1 : -1)
                    selectMemory(i)
                  }}
                  aria-label={`Open memory: ${m.title}`}
                >
                  <Photo src={m.src} type={m.type} alt="" className="thumb-img" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {memory && (
          <motion.div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={memory.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={() => selectMemory(null)}
          >
            <motion.figure
              className="lightbox-card"
              initial={{ scale: 0.82, y: 30, opacity: 0, filter: 'blur(10px)' }}
              animate={{ scale: 1, y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ scale: 0.9, opacity: 0, filter: 'blur(6px)' }}
              transition={{ duration: reducedMotion ? 0.2 : 0.8, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              drag={memories.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70) step(1)
                else if (info.offset.x > 70) step(-1)
              }}
            >
              <div className="lightbox-photo">
                <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                  <motion.div
                    key={lightbox}
                    className="lightbox-photo-inner"
                    custom={dir}
                    initial={{ opacity: 0, x: dir * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: dir * -40 }}
                    transition={{ duration: 0.45 }}
                  >
                    <Photo src={memory.src} type={memory.type} alt={memory.title} className="lightbox-img" full />
                  </motion.div>
                </AnimatePresence>
              </div>
              <figcaption>
                <span className="memory-date">{memory.date}</span>
                <h3>{memory.title}</h3>
                <motion.p key={lightbox} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }}>
                  “{memory.caption}”
                </motion.p>
              </figcaption>
              <button type="button" className="lightbox-close icon-btn" onClick={() => selectMemory(null)} aria-label="Close photo">
                <X size={18} />
              </button>
              {memories.length > 1 && (
                <div className="lightbox-nav">
                  <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous memory">
                    <ChevronLeft size={20} />
                  </button>
                  <span>
                    {lightbox + 1} / {memories.length}
                  </span>
                  <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next memory">
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
