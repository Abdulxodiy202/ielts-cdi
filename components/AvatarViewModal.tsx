'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// Instagram-style fullscreen preview for a user's profile picture. Backdrop
// click and Escape close the modal; the image itself is contained (no
// upscaling past the source) so uploaded photos of any aspect ratio look
// right. When there's no avatar_url we render a large monogram placeholder.

interface Props {
  open: boolean
  onClose: () => void
  avatarUrl: string | null
  displayName?: string | null
}

export function AvatarViewModal({ open, onClose, avatarUrl, displayName }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Prevent underlying page scroll while the modal is open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  const letter = (displayName ?? 'U').trim().charAt(0).toUpperCase() || 'U'

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:opacity-80 transition-opacity"
            style={{ color: 'white', background: 'rgba(255,255,255,0.08)' }}
          >
            <X size={22} />
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="max-w-lg max-h-[85vh] w-full flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName ?? ''}
                className="max-w-full max-h-[85vh] object-contain rounded-2xl"
                style={{ boxShadow: '0 30px 90px rgba(0,0,0,0.6)' }}
              />
            ) : (
              <div
                className="w-72 h-72 md:w-80 md:h-80 rounded-full flex items-center justify-center font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  fontSize: '8rem',
                  boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
                }}
              >
                {letter}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
