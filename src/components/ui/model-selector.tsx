'use client';

import { useState } from 'react';
import { ChevronDown, Check, Zap, Brain, Dna, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getAvailableModels, type ModelConfig } from '@/lib/models/registry';

interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  className?: string;
}

// Icon mapping for different model emojis
const getIconComponent = (icon?: string) => {
  if (!icon) return Brain;

  switch (icon) {
    case '⚡':
      return Zap;
    case '🧠':
      return Brain;
    case '🧬':
      return Dna;
    case '🤖':
      return Bot;
    default:
      return Brain;
  }
};

export function ModelSelector({ selectedModelId, onModelChange, className }: ModelSelectorProps) {
  const models = getAvailableModels();
  const selectedModel = models.find(m => m.id === selectedModelId);
  const SelectedIcon = selectedModel ? getIconComponent(selectedModel.icon) : Brain;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${className || ''}`}>
          <SelectedIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{selectedModel?.name || 'Select Model'}</span>
          <span className="sm:hidden">{selectedModel?.name.split(' ')[0] || 'Model'}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[340px]">
        <DropdownMenuLabel>Select AI Model</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {models.map((model) => {
          const Icon = getIconComponent(model.icon);
          const isSelected = model.id === selectedModelId;

          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onModelChange(model.id)}
              className="flex items-start gap-3 p-3 cursor-pointer"
            >
              <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{model.name}</span>
                  {model.status === 'experimental' && (
                    <Badge variant="outline" className="text-xs py-0 px-1.5">
                      Beta
                    </Badge>
                  )}
                  {isSelected && (
                    <Check className="h-4 w-4 ml-auto flex-shrink-0 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {model.description}
                </p>
                {model.costPer1kTokens && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ${model.costPer1kTokens.input.toFixed(2)}/${model.costPer1kTokens.output.toFixed(2)} per 1K tokens
                  </p>
                )}
                {model.tags && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {model.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
