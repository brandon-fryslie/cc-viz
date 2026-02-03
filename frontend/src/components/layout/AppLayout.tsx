import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string  // Optional for compatibility with cc-viz pages
  description?: string  // Optional for compatibility with cc-viz pages
  actions?: React.ReactNode  // Optional for compatibility with cc-viz pages
  activeItem?: string  // Optional for compatibility with cc-viz pages
}

// Note: This component is kept for backward compatibility with pages that haven't been
// migrated to use the router layout. New pages should not use this component.
// The router in router.tsx handles the layout for all pages.
export function AppLayout({ children, title, description, actions }: AppLayoutProps) {
  // If title is provided, render a page header (for cc-viz compatibility)
  // Otherwise just render children (for dashboard pages)
  if (title) {
    return (
      <>
        <PageHeader title={title} description={description} actions={actions} />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </>
    )
  }

  return <>{children}</>
}

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div>
        <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {description && (
          <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

interface PageContentProps {
  children: React.ReactNode
  className?: string
}

export function PageContent({ children, className }: PageContentProps) {
  return (
    <div className={cn('flex-1 overflow-auto p-4', className)}>
      {children}
    </div>
  )
}
