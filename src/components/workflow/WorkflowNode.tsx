import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  BarChart3,
  Calculator,
  Database,
  Filter,
  GitBranch,
  GitCompare,
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Lightbulb,
} from "lucide-react";
import type { WorkflowNode as WorkflowNodeData } from "@/lib/types/workflow";

export interface WorkflowNodeProps extends WorkflowNodeData {
  color: string;
}

const phaseIcons = {
  "Data Loading": Database,
  "QC Assessment": ShieldCheck,
  "Data Preprocessing": Filter,
  "Exploratory Analysis": Search,
  "Statistical Testing": Calculator,
  "Dimensionality Reduction": GitBranch,
  "Comparative Analysis": GitCompare,
  "Visualization": BarChart3,
  "Analysis": Activity,
};

const getPhaseIcon = (phase: string) => {
  return phaseIcons[phase as keyof typeof phaseIcons] || Activity;
};

const getStatusIcon = (status: "completed" | "in_progress" | "error") => {
  switch (status) {
    case "completed":
      return CheckCircle2;
    case "in_progress":
      return Loader2;
    case "error":
      return XCircle;
  }
};

const getStatusColor = (status: "completed" | "in_progress" | "error") => {
  switch (status) {
    case "completed":
      return "text-emerald-500";
    case "in_progress":
      return "text-blue-500 animate-spin";
    case "error":
      return "text-red-500";
  }
};

export function WorkflowNode({ data }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeProps;
  const PhaseIcon = getPhaseIcon(nodeData.phase);
  const StatusIcon = getStatusIcon(nodeData.status);
  const statusColor = getStatusColor(nodeData.status);

  const artifactCount = nodeData.artifacts?.length || 0;
  const toolCount = nodeData.toolCalls?.length || 0;

  // Only log on mount or when fullResponse changes (avoid spam from re-renders)
  // Comment out to reduce console noise - uncomment for debugging
  // const timestamp = new Date().toISOString().substring(11, 23);
  // console.log(`🖼️ [${timestamp}] [WorkflowNode] Rendering:`, {
  //   id: nodeData.id,
  //   phase: nodeData.phase,
  //   hasMetadata: !!nodeData.metadata,
  //   metadataInsight: nodeData.metadata?.insight,
  //   fullResponseLength: nodeData.fullResponse?.length || 0,
  // });

  return (
    <div className="relative">
      {/* Source Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500"
      />

      {/* Node Card */}
      <div
        className="bg-card border-2 rounded-lg shadow-lg hover:shadow-xl transition-shadow w-[250px]"
        style={{
          borderColor: nodeData.color,
        }}
      >
        {/* Header */}
        <div
          className="p-3 rounded-t-lg flex items-start justify-between gap-2"
          style={{
            backgroundColor: `${nodeData.color}20`,
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PhaseIcon
              className="flex-shrink-0"
              size={18}
              style={{ color: nodeData.color }}
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate text-foreground">
                {nodeData.phase}
              </h4>
              {nodeData.type === "user_query" && (
                <p className="text-xs text-muted-foreground truncate">
                  User Query
                </p>
              )}
            </div>
          </div>
          <StatusIcon className={`flex-shrink-0 ${statusColor}`} size={16} />
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* User Query (PRIMARY - at top) */}
          {nodeData.userQuery && (
            <div className="mb-2">
              <p className="text-sm font-medium text-foreground line-clamp-2 leading-relaxed">
                {nodeData.userQuery.length > 100
                  ? `${nodeData.userQuery.substring(0, 97)}...`
                  : nodeData.userQuery}
              </p>
            </div>
          )}

          {/* Key Insight (Secondary) */}
          {nodeData.metadata?.insight && (
            <div className="flex items-start gap-2 bg-primary/10 rounded p-2 border border-primary/20">
              <Lightbulb
                size={14}
                className="flex-shrink-0 mt-0.5 text-primary"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {nodeData.metadata.insight}
              </p>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {artifactCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                <BarChart3 size={10} className="mr-1" />
                {artifactCount} plot{artifactCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {/* Footer with timestamp */}
        <div className="px-3 pb-2">
          <p className="text-[10px] text-muted-foreground">
            {new Date(nodeData.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Target Handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500"
      />
    </div>
  );
}
