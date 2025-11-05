"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { type ComponentProps, type ReactNode } from "react";

// Suggestions Container
type SuggestionsProps = ComponentProps<"div"> & {
  children: ReactNode;
};

export const Suggestions = ({ className, children, ...props }: SuggestionsProps) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 w-full",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Suggestions.displayName = "Suggestions";

// Individual Suggestion Chip
type SuggestionProps = Omit<ComponentProps<"button">, "onClick"> & {
  suggestion: string;
  onClick: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  ...props
}: SuggestionProps) => {
  const handleClick = () => {
    onClick(suggestion);
  };

  return (
    <div className="relative rounded-lg p-[1px] transition-all duration-300 hover:scale-[1.02]" style={{
      background: 'linear-gradient(135deg, #06D6DB20 0%, #6B3FA020 50%, #E74C9720 100%)',
    }}>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 text-left px-6 py-4",
          "rounded-lg",
          "backdrop-blur-sm",
          "text-base sm:text-lg text-foreground",
          "transition-all duration-200",
          "focus:outline-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "active:scale-[0.98]",
          className
        )}
        style={{
          background: '#1E2940',
          boxShadow: '0 0 15px rgba(6, 214, 219, 0.2)'
        }}
        onMouseEnter={(e) => {
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.style.background = 'linear-gradient(135deg, #06D6DB 0%, #6B3FA0 50%, #E74C97 100%)';
          }
          e.currentTarget.style.boxShadow = '0 0 25px rgba(6, 214, 219, 0.4), 0 0 50px rgba(231, 76, 151, 0.3)';
        }}
        onMouseLeave={(e) => {
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.style.background = 'linear-gradient(135deg, #06D6DB20 0%, #6B3FA020 50%, #E74C9720 100%)';
          }
          e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 214, 219, 0.2)';
        }}
        {...props}
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" style={{
          color: '#06D6DB',
          filter: 'drop-shadow(0 0 4px rgba(6, 214, 219, 0.5))'
        }} />
        <span>{suggestion}</span>
      </button>
    </div>
  );
};

Suggestion.displayName = "Suggestion";
