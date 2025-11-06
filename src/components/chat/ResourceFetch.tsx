import { Loader2, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { ResourceFetchPart } from '@/lib/types';

export function ResourceFetch({
  serverName,
  uri,
  status,
  resource,
  error
}: ResourceFetchPart) {
  const getStatusIcon = () => {
    if (status === 'fetching') {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    if (status === 'complete') {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (status === 'error') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <FileText className="w-4 h-4 text-gray-500" />;
  };

  const getStatusText = () => {
    if (status === 'fetching') return 'Fetching...';
    if (status === 'complete') return 'Complete';
    if (status === 'error') return 'Error';
    return 'Pending';
  };

  // Extract resource name from URI
  const resourceName = resource?.name || uri.split('/').pop() || uri;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon()}
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="font-mono text-sm font-semibold text-gray-900">
          {resourceName}
        </span>
        <span className="text-xs text-blue-600">
          {serverName}
        </span>
        <span className="text-xs text-gray-600">
          {getStatusText()}
        </span>
      </div>

      <div className="text-xs text-gray-600 mb-1">
        <span className="font-mono">{uri}</span>
      </div>

      {resource?.description && (
        <div className="text-xs text-gray-700 mt-2 italic">
          {resource.description}
        </div>
      )}

      {resource?.mimeType && (
        <div className="text-xs text-gray-500 mt-1">
          Type: {resource.mimeType}
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {error}
        </div>
      )}

      {resource?.content && (
        <details className="mt-2">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
            View content
          </summary>
          <pre className="mt-2 text-xs bg-white p-2 rounded border border-blue-300 overflow-x-auto max-h-96 overflow-y-auto">
            {resource.content}
          </pre>
        </details>
      )}
    </div>
  );
}
