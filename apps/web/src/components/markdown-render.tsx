import { cn } from '@yoru/ui'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const COMPONENTS: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer nofollow" className="text-accent underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  h1: ({ children }) => <h3 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-accent/60 pl-3 text-muted-foreground first:mt-0 last:mb-0">{children}</blockquote>,
  code: ({ children, className }) =>
    className ? (
      <code className={cn('font-mono text-[0.8125rem]', className)}>{children}</code>
    ) : (
      <code className="rounded bg-foreground/[0.08] px-1 py-0.5 font-mono text-[0.8125rem]">{children}</code>
    ),
  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-foreground/[0.06] p-3 first:mt-0 last:mb-0">{children}</pre>,
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[0.8125rem]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
  img: ({ alt }) => <span className="text-muted-foreground">{alt}</span>,
}

export default function MarkdownRender({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('break-words text-sm leading-relaxed', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
