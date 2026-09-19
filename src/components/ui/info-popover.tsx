"use client";

import React, { useState } from "react";
import { CircleHelp } from "lucide-react";

interface InfoPopoverProps {
  content: string;
  className?: string;
}

export function InfoPopover({ content, className = "" }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Más información"
      >
        <CircleHelp className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-popover border border-border shadow-lg text-xs text-popover-foreground z-50">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
}
