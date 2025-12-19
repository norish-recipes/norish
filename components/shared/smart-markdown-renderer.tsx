"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";

export interface SmartMarkdownRendererProps {
  text: string;
  className?: string;
  disableLinks?: boolean;
}

/**
 * Renders text with smart markdown processing:
 * - #heading renders as styled heading
 * - /recipe-name renders as clickable link to recipe
 */
export default function SmartMarkdownRenderer({
  text,
  className = "",
  disableLinks = false,
}: SmartMarkdownRendererProps) {
  const processedText = preprocessText(text);

  return (
    <span className={className}>
      <ReactMarkdown
        components={{
          // Style headings distinctly (matching card headers)
          h1: ({ children }) => (
            <span className="text-foreground mt-2 mb-1 block text-lg font-semibold">
              {children}
            </span>
          ),
          h2: ({ children }) => (
            <span className="text-foreground mt-2 mb-1 block text-lg font-semibold">
              {children}
            </span>
          ),
          a: ({ href, children }) => {
            if (href?.startsWith("/recipes/")) {
              if (disableLinks) {
                return (
                  <span className="text-foreground decoration-default-400 font-medium underline underline-offset-2">
                    {children}
                  </span>
                );
              }

              return (
                <Link
                  className="text-foreground decoration-default-400 hover:decoration-default-600 font-medium underline underline-offset-2 transition-colors"
                  href={href}
                  onClick={(e) => e.stopPropagation()}
                >
                  {children}
                </Link>
              );
            }

            if (disableLinks) {
              return (
                <span className="text-foreground decoration-default-400 underline underline-offset-2">
                  {children}
                </span>
              );
            }

            return (
              <a
                className="text-foreground decoration-default-400 hover:decoration-default-600 underline underline-offset-2 transition-colors"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </a>
            );
          },

          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {processedText}
      </ReactMarkdown>
    </span>
  );
}

function preprocessText(text: string): string {
  if (!text) return "";

  let processed = text
    .split("\n")
    .map((line) => {
      if (line.startsWith("#") && !line.startsWith("##")) {
        const content = line.slice(1).trim();

        return `## ${content}`;
      }

      return line;
    })
    .join("\n");

  processed = processed.replace(
    /\[([^\]]+)\]\(id:([a-zA-Z0-9-]+)\)/g,
    (_, recipeName, recipeId) => {
      return `[${recipeName}](/recipes/${recipeId})`;
    }
  );

  return processed;
}
