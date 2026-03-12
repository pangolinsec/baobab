import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const AT_MENTION_SOURCE = '(?:^|(?<=\\s))@([\\w][\\w.\\-]*\\.\\w+)(?=\\s|$)';

/**
 * Scan a string for @filename.ext patterns, split into text + pill spans.
 */
function splitMentions(
  text: string,
  onMentionClick?: (filename: string) => void,
): React.ReactNode[] {
  const re = new RegExp(AT_MENTION_SOURCE, 'g');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const fullMatch = match[0];
    const filename = match[1];
    const start = match.index;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    // Leading whitespace captured by lookbehind
    const mentionStart = fullMatch.indexOf('@');
    if (mentionStart > 0) {
      parts.push(fullMatch.slice(0, mentionStart));
    }

    parts.push(
      <span
        key={`${filename}-${start}`}
        className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)] ${
          onMentionClick ? 'cursor-pointer hover:bg-[var(--color-accent)]/25' : ''
        }`}
        onClick={onMentionClick ? (e) => { e.stopPropagation(); onMentionClick(filename); } : undefined}
        title={onMentionClick ? `View ${filename}` : filename}
      >
        @{filename}
      </span>
    );

    lastIndex = start + fullMatch.length;
  }

  if (parts.length === 0) return [];

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Walk React children arrays, find string children containing @filename.ext,
 * split them and insert inline pill <span> elements.
 */
function processTextForMentions(
  children: React.ReactNode,
  onMentionClick?: (filename: string) => void,
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child !== 'string') return child;

    const parts = splitMentions(child, onMentionClick);
    if (parts.length === 0) return child;
    return <>{parts}</>;
  });
}

interface MarkdownWithFilePillsProps {
  content: string;
  className?: string;
  onMentionClick?: (filename: string) => void;
}

export function MarkdownWithFilePills({ content, className, onMentionClick }: MarkdownWithFilePillsProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className={className}
      components={{
        p: ({ children }) => <p>{processTextForMentions(children, onMentionClick)}</p>,
        li: ({ children }) => <li>{processTextForMentions(children, onMentionClick)}</li>,
        td: ({ children }) => <td>{processTextForMentions(children, onMentionClick)}</td>,
        th: ({ children }) => <th>{processTextForMentions(children, onMentionClick)}</th>,
        blockquote: ({ children }) => <blockquote>{processTextForMentions(children, onMentionClick)}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/**
 * Simple pill rendering for plain text (no markdown).
 * Used in MessageNode preview where ReactMarkdown is overkill.
 */
export function renderTextWithPills(text: string): React.ReactNode {
  const parts = splitMentions(text);
  if (parts.length === 0) return text;
  return <>{parts}</>;
}
