import { useState, useEffect } from 'react'
import { useSearchTodos } from '../lib/api'
import { AppLayout } from '../components/layout'

export function TodosSearchPage() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: searchResults, isLoading, isError, error } = useSearchTodos(
    debouncedSearch,
    statusFilter,
    50,
    offset
  )

  const todos = searchResults?.todos || []
  const total = searchResults?._total || 0
  const limit = searchResults?._limit || 50

  return (
    <AppLayout title="Search Todos">
      <div className="flex flex-col h-full">
        {/* Search Header */}
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search todos (FTS5)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.currentTarget.value)}
              className="w-full border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setOffset(0)
              }}
              className="border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Result Count */}
        <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
          {isLoading ? (
            <span>Searching...</span>
          ) : isError ? (
            <span className="text-red-500">Error: {error?.message}</span>
          ) : todos.length > 0 ? (
            <span>
              Showing {todos.length} todo{todos.length !== 1 ? 's' : ''} of {total}
            </span>
          ) : (
            <span>No todos found</span>
          )}
        </div>

        {/* Todos List */}
        <div className="flex-1 overflow-auto">
          {todos.length === 0 && !isLoading ? (
            <div className="p-4 text-center text-[var(--color-text-muted)]">
              {debouncedSearch ? 'No todos match your search' : 'Enter a search query'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[var(--color-bg-hover)] sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Status</th>
                  <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Content</th>
                  <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Tags</th>
                </tr>
              </thead>
              <tbody>
                {todos.map((todo: any) => (
                  <tr
                    key={todo.id}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
                  >
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        todo.status === 'completed'
                          ? 'bg-green-500/10 text-green-500'
                          : todo.status === 'in_progress'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}>
                        {todo.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-primary)] truncate max-w-xl">
                      {todo.content}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)] text-sm">
                      {todo.tags}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-3 py-1 border border-[var(--color-border)] rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-hover)]"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-[var(--color-text-secondary)]">
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-1 border border-[var(--color-border)] rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-hover)]"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
