"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Context for managing streaming state
interface PlanContextValue {
  isStreaming: boolean;
}

const PlanContext = React.createContext<PlanContextValue>({
  isStreaming: false,
});

const usePlanContext = () => React.useContext(PlanContext);

// Main Plan component
interface PlanProps extends React.ComponentProps<typeof Collapsible> {
  isStreaming?: boolean;
}

export function Plan({
  isStreaming = false,
  defaultOpen = false,
  ...props
}: PlanProps) {
  return (
    <PlanContext.Provider value={{ isStreaming }}>
      <Collapsible defaultOpen={defaultOpen} {...props} />
    </PlanContext.Provider>
  );
}

// PlanHeader component
export const PlanHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof CardHeader>
>(({ className, ...props }, ref) => (
  <CardHeader
    ref={ref}
    className={cn("flex-row items-start justify-between space-y-0 px-6 py-5", className)}
    {...props}
  />
));
PlanHeader.displayName = "PlanHeader";

// PlanTitle component with shimmer animation
export const PlanTitle = React.forwardRef<
  HTMLHeadingElement,
  Omit<React.ComponentProps<typeof CardTitle>, "children"> & {
    children: string;
  }
>(({ className, children, ...props }, ref) => {
  const { isStreaming } = usePlanContext();

  return (
    <CardTitle
      ref={ref}
      className={cn(
        "text-base font-semibold",
        isStreaming && "animate-pulse",
        className
      )}
      {...props}
    >
      {children}
    </CardTitle>
  );
});
PlanTitle.displayName = "PlanTitle";

// PlanDescription component with shimmer animation
export const PlanDescription = React.forwardRef<
  HTMLParagraphElement,
  Omit<React.ComponentProps<typeof CardDescription>, "children"> & {
    children: string;
  }
>(({ className, children, ...props }, ref) => {
  const { isStreaming } = usePlanContext();

  return (
    <CardDescription
      ref={ref}
      className={cn(isStreaming && "animate-pulse", className)}
      {...props}
    >
      {children}
    </CardDescription>
  );
});
PlanDescription.displayName = "PlanDescription";

// PlanTrigger component
export const PlanTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof CollapsibleTrigger>
>(({ className, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <CollapsibleTrigger asChild {...props}>
      <Button
        ref={ref}
        variant="ghost"
        size="icon-sm"
        className={cn("group", className)}
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronDown
          className={cn(
            "transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          size={16}
        />
        <span className="sr-only">Toggle plan</span>
      </Button>
    </CollapsibleTrigger>
  );
});
PlanTrigger.displayName = "PlanTrigger";

// PlanContent component
export const PlanContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof CardContent>
>(({ className, ...props }, ref) => (
  <CollapsibleContent>
    <CardContent ref={ref} className={cn("px-6 py-5", className)} {...props} />
  </CollapsibleContent>
));
PlanContent.displayName = "PlanContent";

// PlanFooter component
export const PlanFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-end gap-2 p-6 pt-0", className)}
    {...props}
  />
));
PlanFooter.displayName = "PlanFooter";

// PlanAction component
export const PlanAction = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof CardAction>
>(({ ...props }, ref) => <CardAction ref={ref} {...props} />);
PlanAction.displayName = "PlanAction";

// Wrapper component that includes Card
export const PlanCard = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Card> & { children: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <Card ref={ref} className={cn("overflow-hidden", className)} {...props}>
    {children}
  </Card>
));
PlanCard.displayName = "PlanCard";
