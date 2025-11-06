import { TextContent } from './TextContent';
import { ToolCall } from './ToolCall';
import { ToolResult } from './ToolResult';
import { ResourceFetch } from './ResourceFetch';
import { PromptFetch } from './PromptFetch';
import type { ResourceFetchPart, PromptFetchPart } from '@/lib/types';

interface MessageProps {
  role: 'user' | 'assistant';
  parts: any[];
}

export function Message({ role, parts }: MessageProps) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl w-full rounded-lg p-4 ${
        role === 'user' 
          ? 'bg-blue-50 border border-blue-200' 
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            role === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-purple-600 text-white'
          }`}>
            {role === 'user' ? 'U' : 'A'}
          </div>
          <span className="font-semibold text-sm text-gray-700 capitalize">
            {role}
          </span>
        </div>
        
        <div className="space-y-2">
          {parts.map((part, idx) => {
            console.log('[Message] Rendering part:', part);
            if (part.type === 'text') {
              return <TextContent key={idx} text={part.text} />;
            }
            
            if (part.type === 'tool-call') {
              return (
                <ToolCall
                  key={idx}
                  toolName={part.toolName}
                  args={part.args}
                  state={part.state}
                />
              );
            }
            
            if (part.type === 'tool-result') {
              return (
                <ToolResult
                  key={idx}
                  toolName={part.toolName}
                  result={part.result}
                  isError={part.isError}
                />
              );
            }

            if (part.type === 'resource-fetch') {
              return (
                <ResourceFetch
                  key={idx}
                  {...(part as ResourceFetchPart)}
                />
              );
            }

            if (part.type === 'prompt-fetch') {
              return (
                <PromptFetch
                  key={idx}
                  {...(part as PromptFetchPart)}
                />
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}