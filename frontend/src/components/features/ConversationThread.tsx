import { type FC, useMemo, useState, useRef, useEffect } from 'react'
import { User, Bot, Clock, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ClaudeCodeMessage, AnthropicContentBlock } from '@/lib/types'
import { filterMessages } from '@/lib/search'
import { highlightMatches } from '@/lib/searchHighlight'
import { useSearch } from '@/lib/SearchContext'

interface ConversationThreadProps {
  messages: ClaudeCodeMessage[]
  startTime: string
  endTime: string
}

export const ConversationThread: FC<ConversationThreadProps> = ({
  messages,
  startTime,
  endTime,
}) => {
  const { query: searchQuery, scope } = useSearch()
  const [showJumpButtons, setShowJumpButtons] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesStartRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Only filter when scope is 'this-session'
  const shouldFilter = scope.kind === 'this-session'

  // Filter to only user/assistant messages with valid content
  const chatMessages = useMemo(() => {
    const filtered = messages.filter(m =>
      (m.type === 'user' || m.type === 'assistant') &&
      m.message?.content
    )
    return (shouldFilter && searchQuery) ? filterMessages(filtered, searchQuery) : filtered
  }, [messages, searchQuery, shouldFilter])

  // Count by role
  const stats = useMemo(() => {
    const userCount = chatMessages.filter(m => m.type === 'user').length
    const assistantCount = chatMessages.filter(m => m.type === 'assistant').length
    return { total: chatMessages.length, userCount, assistantCount }
  }, [chatMessages])

  // Auto-scroll to latest when conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Show/hide jump buttons based on scroll position
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      // Show buttons if scrolled more than 200px from top or bottom
      const isScrolledFromTop = scrollTop > 200
      const isScrolledFromBottom = scrollHeight - scrollTop - clientHeight > 200
      setShowJumpButtons(isScrolledFromTop || isScrolledFromBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    messagesStartRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header with stats */}
      <div className="sticky top-0 z-10 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
              {formatTimeRange(startTime, endTime)}
            </span>
            <span>{stats.total} messages</span>
            <span className="text-[var(--color-text-muted)]">
              ({stats.userCount} user, {stats.assistantCount} assistant)
            </span>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        <div ref={messagesStartRef} />
        {chatMessages.map((msg, idx) => (
          <MessageBubble
            key={msg.uuid || idx}
            message={msg}
            searchQuery={shouldFilter ? searchQuery : ''}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to top/bottom buttons - only show when scrolled */}
      {showJumpButtons && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={scrollToTop}
            className="p-2 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            aria-label="Scroll to top"
          >
            <ArrowUp size={16} className="text-[var(--color-text-primary)]" />
          </button>
          <button
            onClick={scrollToBottom}
            className="p-2 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shadow-lg hover:bg-[var(--color-bg-hover)] transition-colors"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} className="text-[var(--color-text-primary)]" />
          </button>
        </div>
      )}
    </div>
  )
}

// Individual message bubble
interface MessageBubbleProps {
  message: ClaudeCodeMessage
  searchQuery: string
}

const MessageBubble: FC<MessageBubbleProps> = ({ message, searchQuery }) => {
  const isUser = message.type === 'user'
  const content = message.message?.content

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg p-3 ${
          isUser
            ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
            : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isUser
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300'
                : 'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300'
            }`}
          >
            {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
          </div>
          <span className="font-medium text-xs text-[var(--color-text-primary)]">
            {isUser ? 'User' : 'Assistant'}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        <div className="prose prose-base max-w-none dark:prose-invert" style={{ fontFamily: "'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif" }}>
          <MessageContent content={content} searchQuery={searchQuery} />
        </div>
      </div>
    </div>
  )
}

interface MessageContentProps {
  content: string | AnthropicContentBlock[] | undefined
  searchQuery: string
}

function MarkdownText({ text, searchQuery }: { text: string; searchQuery: string }) {
  if (searchQuery) {
    return (
      <div className="whitespace-pre-wrap">
        {highlightMatches(text, searchQuery)}
      </div>
    )
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Keep code blocks styled with monospace
        code: ({ children, className, ...props }) => {
          const isBlock = className?.startsWith('language-')
          return isBlock ? (
            <code className={`${className} text-[0.8em]`} {...props}>{children}</code>
          ) : (
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[0.85em] font-mono" {...props}>{children}</code>
          )
        },
        pre: ({ children, ...props }) => (
          <pre className="overflow-auto rounded-md bg-[var(--color-bg-tertiary)] p-3 text-[0.85em] font-mono" {...props}>{children}</pre>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

const MessageContent: FC<MessageContentProps> = ({ content, searchQuery }) => {
  if (!content) return <span className="text-[var(--color-text-muted)]">No content</span>

  if (typeof content === 'string') {
    return <MarkdownText text={content} searchQuery={searchQuery} />
  }

  if (Array.isArray(content)) {
    return (
      <div className="space-y-2">
        {content.map((block, i) => (
          <div key={i}>
            {block.type === 'text' && block.text && (
              <MarkdownText text={block.text} searchQuery={searchQuery} />
            )}
            {block.type === 'tool_use' && (
              <CollapsibleToolUse block={block} searchQuery={searchQuery} />
            )}
            {block.type === 'tool_result' && (
              <CollapsibleToolResult block={block} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <pre className="text-xs text-[var(--color-text-muted)]">
      {JSON.stringify(content, null, 2)}
    </pre>
  )
}

// Collapsible tool use block
const CollapsibleToolUse: FC<{ block: AnthropicContentBlock; searchQuery: string }> = ({
  block,
  searchQuery,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="text-sm bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
      >
        <span className="font-medium text-purple-700 dark:text-purple-300 text-xs">
          {searchQuery ? highlightMatches(`Tool: ${block.name}`, searchQuery) : `Tool: ${block.name}`}
        </span>
        {isExpanded ? (
          <ChevronUp size={14} className="text-purple-600 dark:text-purple-400" />
        ) : (
          <ChevronDown size={14} className="text-purple-600 dark:text-purple-400" />
        )}
      </button>
      {isExpanded && (
        <pre className="text-xs text-[var(--color-text-secondary)] overflow-auto max-h-64 px-2 py-1.5 bg-white/50 dark:bg-black/20">
          {JSON.stringify(block.input, null, 2)}
        </pre>
      )}
    </div>
  )
}

// Collapsible tool result block
const CollapsibleToolResult: FC<{ block: AnthropicContentBlock }> = ({ block }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const resultText = typeof block.content === 'string'
    ? block.content
    : JSON.stringify(block.content, null, 2)

  // Show preview (first 100 chars)
  const preview = resultText.length > 100 ? resultText.substring(0, 100) + '...' : resultText

  return (
    <div className="text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
      >
        <span className="font-medium text-green-700 dark:text-green-300 text-xs">
          Tool Result
        </span>
        {isExpanded ? (
          <ChevronUp size={14} className="text-green-600 dark:text-green-400" />
        ) : (
          <ChevronDown size={14} className="text-green-600 dark:text-green-400" />
        )}
      </button>
      {!isExpanded && (
        <div className="px-2 py-1 text-xs text-[var(--color-text-secondary)] truncate">
          {preview}
        </div>
      )}
      {isExpanded && (
        <pre className="text-xs text-[var(--color-text-secondary)] overflow-auto max-h-96 px-2 py-1.5 bg-white/50 dark:bg-black/20 whitespace-pre-wrap">
          {resultText}
        </pre>
      )}
    </div>
  )
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const durationMs = endDate.getTime() - startDate.getTime()
  const durationMins = Math.round(durationMs / 60000)

  if (durationMins < 60) {
    return `${durationMins}m`
  }
  return `${Math.round(durationMins / 60)}h ${durationMins % 60}m`
}
