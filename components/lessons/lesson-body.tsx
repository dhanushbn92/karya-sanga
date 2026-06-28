import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders lesson body markdown server-side.
 * - GitHub-flavored markdown (tables, task lists, strikethrough)
 * - Code blocks render as plain monospace text (syntax highlighting was
 *   removed to keep the worker bundle small; can be re-added later).
 * - Styled with Tailwind via the prose-like wrapper below
 */
export function LessonBody({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return (
      <p className="text-on-surface-variant">
        This lesson doesn&apos;t have content yet.
      </p>
    );
  }

  return (
    <div className="lesson-prose text-on-surface">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1 className="mt-8 mb-4 text-3xl font-bold text-on-surface" {...props} />
          ),
          h2: (props) => (
            <h2 className="mt-7 mb-3 text-2xl font-bold text-on-surface" {...props} />
          ),
          h3: (props) => (
            <h3 className="mt-6 mb-2 text-xl font-bold text-on-surface" {...props} />
          ),
          p: (props) => (
            <p className="my-3 leading-7 text-on-surface-variant" {...props} />
          ),
          ul: (props) => (
            <ul className="my-3 list-disc space-y-1 pl-6 text-on-surface-variant" {...props} />
          ),
          ol: (props) => (
            <ol className="my-3 list-decimal space-y-1 pl-6 text-on-surface-variant" {...props} />
          ),
          li: (props) => <li className="leading-7" {...props} />,
          a: ({ href, ...props }) => (
            <a
              href={href}
              className="font-bold text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={
                href?.startsWith("http") ? "noopener noreferrer" : undefined
              }
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-4 rounded-r-2xl border-l-4 border-primary bg-primary-fixed/40 px-4 py-2 text-on-surface"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[0.9em] text-primary"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre
              className="my-4 overflow-x-auto rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-4 text-sm"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-4 overflow-x-auto rounded-2xl border-2 border-outline-variant">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border-b border-outline-variant bg-surface-container px-3 py-2 text-left font-bold text-on-surface"
              {...props}
            />
          ),
          td: (props) => (
            <td className="border-b border-outline-variant/40 px-3 py-2" {...props} />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
