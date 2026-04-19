import { useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const DEPT_COLORS: Record<string, string> = {
  CSC: "#e6a817", CYB: "#e05555", MAT: "#4d8ddb",
  ITC: "#45b078", PHY: "#45adb5",
};

function getDeptColor(prefix: string) { return DEPT_COLORS[prefix] || "#999"; }
function getCourseLevel(num: string): number { const n = parseInt(num); if (n < 2000) return 1; if (n < 3000) return 2; if (n < 4000) return 3; return 4; }

type CourseNode = { id: string; prefix: string; number: string; title: string; credits: number | null };
type PrereqRel = { course_id: string; prerequisite_id: string | null; relationship_type: string; course?: CourseNode | null; prerequisite?: CourseNode | null };

interface MajorGraphProps {
  courseIds: Set<string>;
  allPrereqs: PrereqRel[];
  courses: CourseNode[];
  highlightIds?: Set<string>;
  onNodeClick?: (courseId: string) => void;
  height?: string;
}

const MajorGraph = ({ courseIds, allPrereqs, courses, highlightIds, onNodeClick, height = "500px" }: MajorGraphProps) => {
  const { computedNodes, computedEdges } = useMemo(() => {
    const nodeMap = new Map<string, CourseNode & { inMajor: boolean }>();
    const edgeList: Edge[] = [];
    const edgeSet = new Set<string>();

    for (const c of courses) {
      if (courseIds.has(c.id)) nodeMap.set(c.id, { ...c, inMajor: true });
    }

    for (const rel of allPrereqs) {
      if (rel.prerequisite_id && courseIds.has(rel.course_id)) {
        const ek = `${rel.prerequisite_id}-${rel.course_id}`;
        if (edgeSet.has(ek)) continue;
        edgeSet.add(ek);
        if (rel.prerequisite && !nodeMap.has(rel.prerequisite.id)) {
          nodeMap.set(rel.prerequisite.id, { ...rel.prerequisite, inMajor: false });
        }
        const isCoreq = rel.relationship_type === "corequisite";
        edgeList.push({
          id: `e-${ek}`,
          source: rel.prerequisite_id,
          target: rel.course_id,
          animated: !isCoreq,
          label: isCoreq ? "co-req" : undefined,
          labelStyle: { fontSize: 8, fontWeight: 600 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: rel.prerequisite ? getDeptColor(rel.prerequisite.prefix) : "#999" },
          style: {
            stroke: rel.prerequisite ? getDeptColor(rel.prerequisite.prefix) : "#999",
            strokeWidth: 2,
            strokeDasharray: isCoreq ? "5 3" : undefined,
          },
        });
      }
    }

    const nodeArray = Array.from(nodeMap.values());
    const levels = new Map<number, (typeof nodeArray)>();
    for (const n of nodeArray) {
      const lvl = getCourseLevel(n.number);
      if (!levels.has(lvl)) levels.set(lvl, []);
      levels.get(lvl)!.push(n);
    }
    for (const [, g] of levels) g.sort((a, b) => a.prefix.localeCompare(b.prefix) || a.number.localeCompare(b.number));

    const sortedLevels = Array.from(levels.keys()).sort();
    const NODE_W = 200;
    const GAP_X = 25;
    const GAP_Y = 150;

    const nodes: Node[] = [];
    for (let li = 0; li < sortedLevels.length; li++) {
      const group = levels.get(sortedLevels[li])!;
      const totalW = group.length * NODE_W + (group.length - 1) * GAP_X;
      const startX = -totalW / 2;

      for (let ri = 0; ri < group.length; ri++) {
        const n = group[ri];
        const color = getDeptColor(n.prefix);
        const isHighlighted = highlightIds?.has(n.id);

        nodes.push({
          id: n.id,
          position: { x: startX + ri * (NODE_W + GAP_X), y: li * GAP_Y },
          data: {
            label: (
              <div style={{
                width: NODE_W,
                padding: "8px 10px",
                borderRadius: 8,
                border: `2px solid ${isHighlighted ? color : n.inMajor ? color + "60" : "#ddd"}`,
                background: isHighlighted ? `${color}20` : n.inMajor ? `${color}08` : "#fafafa",
                boxShadow: isHighlighted ? `0 0 16px ${color}30` : "none",
                opacity: n.inMajor ? 1 : 0.55,
                cursor: "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color }}>{n.prefix} {n.number}</span>
                  {n.credits && <span style={{ fontSize: 9, color, fontWeight: 600 }}>{n.credits}cr</span>}
                </div>
                <div style={{ fontSize: 10, color: "#777", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</div>
              </div>
            ),
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });
      }
    }

    return { computedNodes: nodes, computedEdges: edgeList };
  }, [courseIds, allPrereqs, courses, highlightIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  return (
    <div style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.15}
        maxZoom={2}
        defaultEdgeOptions={{ type: "smoothstep" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(40 10% 88%)" gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => (courseIds.has(n.id) ? "#e6a817" : "#ccc")}
          maskColor="rgba(245,243,238,0.8)"
          style={{ borderRadius: 6 }}
        />
      </ReactFlow>
    </div>
  );
};

export default MajorGraph;
