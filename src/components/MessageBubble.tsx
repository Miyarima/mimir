import { User, Globe, FileText, Image } from 'lucide-react'
import type { Message } from '../types'
import { isImage, formatFileSize } from '../services/file'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F\u00AD\u200B-\u200D\uFEFF\u2060-\u2064\u2066-\u2069]/g, '')
}

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {isUser ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
          <User size={15} />
        </div>
      ) : (
        <img src="/logo.svg" alt="Mimir" className="mt-0.5 h-8 w-8 shrink-0" />
      )}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5">
            {message.attachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
                {isImage(att.type) ? (
                  <>
                    <Image className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{att.name}</span>
                    <span className="text-muted-foreground/50">{formatFileSize(att.size)}</span>
                    <img src={att.content} alt={att.name} className="mt-1 max-h-32 max-w-full rounded-lg object-contain" />
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{att.name}</span>
                    <span className="text-muted-foreground/50">{formatFileSize(att.size)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <div className={`px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-md'
            : 'bg-card text-card-foreground rounded-2xl rounded-tl-md border border-border'
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{sanitize(message.content)}</p>
          ) : (
            <div className="markdown-body text-sm leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                       className="text-primary hover:underline">{children}</a>
                  ),
                  code: ({ children }) => (
                    <code className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[12px]">{children}</code>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse border border-border">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border bg-muted px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-3 py-2 text-sm text-foreground/90">{children}</td>
                  ),
                }}
              >
                {sanitize(message.content)}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">
                <Globe size={10} />
                <span className="max-w-[120px] truncate">{s.title}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
