/**
 * ADWO 2.0 Code Message
 * Renders code blocks with syntax highlighting indication.
 */

"use client";

import type { CodeContent } from "@/stores/chat-store";
import { Badge } from "@/components/ui/badge";
import { FileCode } from "lucide-react";

interface CodeMessageProps {
  content: CodeContent;
}

export function CodeMessage({ content }: CodeMessageProps) {
  return (
    <div className="space-y-2">
      {/* Header with filename/language */}
      {(content.filename || content.language) && (
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
          {content.filename && (
            <span className="text-xs font-mono">{content.filename}</span>
          )}
          {content.language && (
            <Badge variant="outline" className="text-xs">
              {content.language}
            </Badge>
          )}
        </div>
      )}

      {/* Code block */}
      <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
        <code>{content.code}</code>
      </pre>
    </div>
  );
}
