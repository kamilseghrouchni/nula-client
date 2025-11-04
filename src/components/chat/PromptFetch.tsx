import { Loader2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { PromptFetchPart } from '@/lib/types';

export function PromptFetch({
  serverName,
  promptName,
  args,
  status,
  prompt,
  error
}: PromptFetchPart) {
  const getStatusIcon = () => {
    if (status === 'fetching') {
      return <Loader2 className="w-4 h-4 animate-spin text-purple-500" />;
    }
    if (status === 'complete') {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (status === 'error') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Sparkles className="w-4 h-4 text-gray-500" />;
  };

  const getStatusText = () => {
    if (status === 'fetching') return 'Fetching...';
    if (status === 'complete') return 'Complete';
    if (status === 'error') return 'Error';
    return 'Pending';
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon()}
        <Sparkles className="w-4 h-4 text-purple-600" />
        <span className="font-mono text-sm font-semibold text-gray-900">
          {promptName}
        </span>
        <span className="text-xs text-purple-600">
          {serverName}
        </span>
        <span className="text-xs text-gray-600">
          {getStatusText()}
        </span>
      </div>

      {prompt?.description && (
        <div className="text-xs text-gray-700 mt-2 italic">
          {prompt.description}
        </div>
      )}

      {args && Object.keys(args).length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
            View arguments
          </summary>
          <pre className="mt-2 text-xs bg-white p-2 rounded border border-purple-300 overflow-x-auto">
            {JSON.stringify(args, null, 2)}
          </pre>
        </details>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {error}
        </div>
      )}

      {prompt?.messages && prompt.messages.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
            View prompt messages ({prompt.messages.length})
          </summary>
          <div className="mt-2 space-y-2">
            {prompt.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`text-xs p-2 rounded border ${
                  msg.role === 'user'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="font-semibold text-gray-700 mb-1">
                  {msg.role.toUpperCase()}:
                </div>
                <div className="text-gray-900 whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
