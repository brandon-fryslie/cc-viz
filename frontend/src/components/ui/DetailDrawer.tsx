import { type FC, type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface DetailDrawerProps {
  /**
   * Whether the drawer is open
   */
  isOpen: boolean
  /**
   * Callback when the drawer should close
   */
  onClose: () => void
  /**
   * Drawer title
   */
  title?: string
  /**
   * Drawer content
   */
  children: ReactNode
  /**
   * Drawer width (defaults to 400px)
   */
  width?: string
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * DetailDrawer slides in from the right side with a backdrop overlay.
 * Closes on Escape key or backdrop click.
 *
 * @example
 * ```tsx
 * <DetailDrawer
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Request Details"
 * >
 *   <div>Drawer content here</div>
 * </DetailDrawer>
 * ```
 */
export const DetailDrawer: FC<DetailDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = '400px',
  className,
}) => {
  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-[var(--duration-base)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] shadow-[var(--elevation-3)] z-50 flex flex-col',
          'transform transition-transform duration-[var(--duration-slow)] ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          {title && (
            <h2 className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)]">
              {title}
            </h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="ml-auto"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </>
  )
}
