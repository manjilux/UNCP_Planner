import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch, Layers, ArrowDown, ArrowRight, Filter, Maximize2, Info,
  Search, Download, Route, X, ZoomIn, BarChart3, Crosshair, Minimize2,
  BookOpen, Link2, Hash, ChevronsUpDown, Calendar, AlertTriangle, CheckCircle2, GraduationCap
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toPng } from "html-to-image";
import FourYearPlan from "@/components/FourYearPlan";

const DEPT_COLORS: Record<string, string> = {
  CSC: "#e6a817", CYB: "#e05555", MAT: "#4d8ddb",
  ITC: "#45b078", PHY: "#45adb5", CHM: "#c9a33a",
  ENG: "#9b7dcf", BIO: "#6abf69", STA: "#e08040",
};

function getDeptColor(prefix: string) { return DEPT_COLORS[prefix] || "#888"; }
function getCourseLevel(num: string): number {
  const n = parseInt(num);
  if (n < 2000) return 1;
  if (n < 3000) return 2;
  if (n < 4000) return 3;
  return 4;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Freshman (1000)",
  2: "Sophomore (2000)",
  3: "Junior (3000)",
  4: "Senior (4000+)",
};

type LayoutDir = "TB" | "LR";
type ViewMode = "graph" | "stats" | "critical" | "planner";

// BFS shortest path
function bfsPath(adj: Map<string, string[]>, start: string, end: string): string[] | null {
  if (start === end) return [start];
  const visited = new Set<string>();
  const queue: string[][] = [[start]];
  visited.add(start);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    const neighbors = adj.get(current) || [];
    for (const n of neighbors) {
      if (visited.has(n)) continue;
      const newPath = [...path, n];
      if (n === end) return newPath;
      visited.add(n);
      queue.push(newPath);
    }
  }
  return null;
}

const PrereqGraphInner = () => {
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const graphRef = useRef<HTMLDivElement>(null);

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [layoutDir, setLayoutDir] = useState<LayoutDir>("TB");
  const [showExternalPrereqs, setShowExternalPrereqs] = useState(true);
  const [showCoreqs, setShowCoreqs] = useState(true);
  const [showCategories, setShowCategories] = useState(true);
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Path finder
  const [pathFinderOpen, setPathFinderOpen] = useState(false);
  const [pathStart, setPathStart] = useState<string | null>(null);
  const [pathEnd, setPathEnd] = useState<string | null>(null);
  const [foundPath, setFoundPath] = useState<Set<string>>(new Set());

  const { data: programs } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("*").order("code");
      return data || [];
    },
  });

  const selectedProgram = useMemo(() => {
    if (!programs?.length) return null;
    if (selectedProgramId) return programs.find(p => p.id === selectedProgramId) || programs[0];
    return programs[0];
  }, [programs, selectedProgramId]);

  const { data: requirements } = useQuery({
    queryKey: ["program-requirements-graph", selectedProgram?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_requirements")
        .select("*, course:courses(id, department_prefix, course_number, title, credits, description)")
        .eq("program_id", selectedProgram!.id);
      return data || [];
    },
    enabled: !!selectedProgram?.id,
  });

  const { data: allPrereqs } = useQuery({
    queryKey: ["all-prereqs-graph"],
    queryFn: async () => {
      const { data } = await supabase
        .from("prerequisite_relationships")
        .select("course_id, prerequisite_id, relationship_type, prerequisite_text, course:courses!prerequisite_relationships_course_id_fkey(id, department_prefix, course_number, title, credits), prerequisite:courses!prerequisite_relationships_prerequisite_id_fkey(id, department_prefix, course_number, title, credits)");
      return data || [];
    },
  });

  const { data: allCourses } = useQuery({
    queryKey: ["all-courses-graph"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, department_prefix, course_number, title, credits, description");
      return data || [];
    },
  });

  const majorCourseIds = useMemo(() => {
    const ids = new Set<string>();
    if (!requirements) return ids;
    for (const r of requirements) { if (r.course_id) ids.add(r.course_id); }
    return ids;
  }, [requirements]);

  const availableDepts = useMemo(() => {
    if (!allCourses || majorCourseIds.size === 0) return [];
    const depts = new Set<string>();
    for (const c of allCourses) {
      if (majorCourseIds.has(c.id)) depts.add(c.department_prefix);
    }
    if (allPrereqs) {
      for (const rel of allPrereqs) {
        if (majorCourseIds.has(rel.course_id) && rel.prerequisite) {
          depts.add((rel.prerequisite as any).department_prefix);
        }
      }
    }
    return Array.from(depts).sort();
  }, [allCourses, majorCourseIds, allPrereqs]);

  useEffect(() => {
    setDeptFilter(new Set());
    setSelectedNodeInfo(null);
    setFoundPath(new Set());
    setPathStart(null);
    setPathEnd(null);
  }, [selectedProgram?.id]);

  // Adjacency for path finder (undirected)
  const adjacency = useMemo(() => {
    const adj = new Map<string, string[]>();
    if (!allPrereqs) return adj;
    for (const rel of allPrereqs) {
      if (!rel.prerequisite_id) continue;
      if (!adj.has(rel.course_id)) adj.set(rel.course_id, []);
      if (!adj.has(rel.prerequisite_id)) adj.set(rel.prerequisite_id, []);
      adj.get(rel.course_id)!.push(rel.prerequisite_id);
      adj.get(rel.prerequisite_id)!.push(rel.course_id);
    }
    return adj;
  }, [allPrereqs]);

  // Connected nodes for hover highlighting
  const connectedMap = useMemo(() => {
    if (!allPrereqs) return new Map<string, Set<string>>();
    const map = new Map<string, Set<string>>();
    const addConnection = (a: string, b: string) => {
      if (!map.has(a)) map.set(a, new Set());
      if (!map.has(b)) map.set(b, new Set());
      map.get(a)!.add(b);
      map.get(b)!.add(a);
    };
    for (const rel of allPrereqs) {
      if (!rel.prerequisite_id) continue;
      addConnection(rel.course_id, rel.prerequisite_id);
    }
    return map;
  }, [allPrereqs]);

  const getTransitiveConnections = useCallback((nodeId: string): Set<string> => {
    const visited = new Set<string>();
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = connectedMap.get(current);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited.has(n)) queue.push(n);
        }
      }
    }
    visited.delete(nodeId);
    return visited;
  }, [connectedMap]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allCourses) return [];
    const q = searchQuery.toLowerCase();
    return allCourses
      .filter(c => majorCourseIds.has(c.id) || (allPrereqs || []).some(r => r.prerequisite_id === c.id && majorCourseIds.has(r.course_id)))
      .filter(c =>
        `${c.department_prefix} ${c.course_number}`.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [searchQuery, allCourses, majorCourseIds, allPrereqs]);

  // Compute path
  useEffect(() => {
    if (pathStart && pathEnd && adjacency.size > 0) {
      const path = bfsPath(adjacency, pathStart, pathEnd);
      setFoundPath(path ? new Set(path) : new Set());
    } else {
      setFoundPath(new Set());
    }
  }, [pathStart, pathEnd, adjacency]);

  // Stats data
  const statsData = useMemo(() => {
    if (!requirements || !allCourses || !allPrereqs) return null;
    const courseMap = new Map(allCourses.map(c => [c.id, c]));
    
    let totalCredits = 0;
    const catCredits: Record<string, number> = {};
    const deptCredits: Record<string, number> = {};
    const levelCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let coursesWithPrereqs = 0;
    let maxChainLength = 0;

    for (const r of requirements) {
      if (!r.course_id) continue;
      const c = courseMap.get(r.course_id);
      if (!c) continue;
      const cr = c.credits || 3;
      totalCredits += cr;
      catCredits[r.category] = (catCredits[r.category] || 0) + cr;
      deptCredits[c.department_prefix] = (deptCredits[c.department_prefix] || 0) + cr;
      levelCounts[getCourseLevel(c.course_number)]++;
      
      const hasPrereq = allPrereqs.some(p => p.course_id === c.id && p.prerequisite_id);
      if (hasPrereq) coursesWithPrereqs++;
    }

    // Find longest chain via DFS
    const dirAdj = new Map<string, string[]>();
    for (const rel of allPrereqs) {
      if (!rel.prerequisite_id) continue;
      if (!dirAdj.has(rel.prerequisite_id)) dirAdj.set(rel.prerequisite_id, []);
      dirAdj.get(rel.prerequisite_id)!.push(rel.course_id);
    }
    
    const dfsDepth = (id: string, visited: Set<string>): number => {
      visited.add(id);
      let max = 0;
      for (const next of (dirAdj.get(id) || [])) {
        if (!visited.has(next) && majorCourseIds.has(next)) {
          max = Math.max(max, 1 + dfsDepth(next, visited));
        }
      }
      visited.delete(id);
      return max;
    };
    
    for (const cid of majorCourseIds) {
      maxChainLength = Math.max(maxChainLength, dfsDepth(cid, new Set()));
    }

    return {
      totalCredits,
      catCredits,
      deptCredits,
      levelCounts,
      coursesWithPrereqs,
      totalCourses: requirements.filter(r => r.course_id).length,
      maxChainLength,
    };
  }, [requirements, allCourses, allPrereqs, majorCourseIds]);

  // Critical path analysis: topological sort to compute minimum semesters
  const criticalPathData = useMemo(() => {
    if (!requirements || !allCourses || !allPrereqs || majorCourseIds.size === 0) return null;

    const courseMap = new Map(allCourses.map(c => [c.id, c]));
    const reqCatMap = new Map<string, string>();
    for (const r of requirements) {
      if (r.course_id) reqCatMap.set(r.course_id, r.category);
    }

    // Build directed graph within major courses only
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    const prereqsOf = new Map<string, string[]>();

    for (const cid of majorCourseIds) {
      inDegree.set(cid, 0);
      if (!adjList.has(cid)) adjList.set(cid, []);
      if (!prereqsOf.has(cid)) prereqsOf.set(cid, []);
    }

    for (const rel of allPrereqs) {
      if (!rel.prerequisite_id) continue;
      if (!majorCourseIds.has(rel.course_id)) continue;
      if (!majorCourseIds.has(rel.prerequisite_id)) continue;
      if (!adjList.has(rel.prerequisite_id)) adjList.set(rel.prerequisite_id, []);
      adjList.get(rel.prerequisite_id)!.push(rel.course_id);
      prereqsOf.get(rel.course_id)?.push(rel.prerequisite_id);
      inDegree.set(rel.course_id, (inDegree.get(rel.course_id) || 0) + 1);
    }

    type SemCourse = {
      id: string; prefix: string; number: string; title: string;
      credits: number | null; category?: string; isCritical: boolean;
    };
    const semesters: SemCourse[][] = [];
    const depth = new Map<string, number>();

    let queue: string[] = [];
    for (const cid of majorCourseIds) {
      if ((inDegree.get(cid) || 0) === 0) {
        queue.push(cid);
        depth.set(cid, 0);
      }
    }

    while (queue.length > 0) {
      const nextQueue: string[] = [];
      const semCourses: SemCourse[] = [];
      const semIdx = semesters.length;

      for (const cid of queue) {
        const c = courseMap.get(cid);
        if (c) {
          semCourses.push({
            id: c.id, prefix: c.department_prefix, number: c.course_number,
            title: c.title, credits: c.credits, category: reqCatMap.get(c.id), isCritical: false,
          });
        }
        for (const next of (adjList.get(cid) || [])) {
          const newDeg = (inDegree.get(next) || 1) - 1;
          inDegree.set(next, newDeg);
          if (newDeg === 0) {
            nextQueue.push(next);
            depth.set(next, semIdx + 1);
          }
        }
      }
      semCourses.sort((a, b) => a.prefix.localeCompare(b.prefix) || a.number.localeCompare(b.number));
      semesters.push(semCourses);
      queue = nextQueue;
    }

    // Mark critical path (backtrack from deepest)
    const criticalSet = new Set<string>();
    const reverseDfs = (cid: string, targetDepth: number) => {
      criticalSet.add(cid);
      for (const pid of (prereqsOf.get(cid) || [])) {
        if (depth.get(pid) === targetDepth - 1 && !criticalSet.has(pid)) {
          reverseDfs(pid, targetDepth - 1);
          break;
        }
      }
    };
    if (semesters.length > 0) {
      const lastSem = semesters[semesters.length - 1];
      if (lastSem[0]) reverseDfs(lastSem[0].id, semesters.length - 1);
    }
    for (const sem of semesters) {
      for (const c of sem) c.isCritical = criticalSet.has(c.id);
    }

    // Unscheduled (circular deps)
    const scheduled = new Set(semesters.flat().map(c => c.id));
    const unscheduled: SemCourse[] = [];
    for (const cid of majorCourseIds) {
      if (!scheduled.has(cid)) {
        const c = courseMap.get(cid);
        if (c) unscheduled.push({ id: c.id, prefix: c.department_prefix, number: c.course_number, title: c.title, credits: c.credits, category: reqCatMap.get(c.id), isCritical: false });
      }
    }

    const totalCredits = semesters.flat().reduce((s, c) => s + (c.credits || 3), 0);
    const semesterCredits = semesters.map(sem => sem.reduce((s, c) => s + (c.credits || 3), 0));

    return {
      semesters, unscheduled, criticalSet, totalCredits, semesterCredits,
      maxCreditsPerSem: Math.max(...semesterCredits, 0),
      avgCreditsPerSem: semesters.length > 0 ? Math.round(totalCredits / semesters.length) : 0,
      minSemesters: semesters.length,
    };
  }, [requirements, allCourses, allPrereqs, majorCourseIds]);

  const graphData = useMemo(() => {
    if (!allPrereqs || !allCourses || majorCourseIds.size === 0)
      return { nodes: [] as Node[], edges: [] as Edge[], stats: { total: 0, prereqEdges: 0, coreqEdges: 0, depts: 0 } };

    const courseMap = new Map(allCourses.map(c => [c.id, c]));
    type NodeInfo = {
      id: string; prefix: string; number: string; title: string;
      credits: number | null; inMajor: boolean; category?: string; description?: string;
    };
    const nodeMap = new Map<string, NodeInfo>();
    const edgeList: Edge[] = [];
    const edgeSet = new Set<string>();
    let prereqEdges = 0, coreqEdges = 0;

    const reqCatMap = new Map<string, string>();
    if (requirements) {
      for (const r of requirements) {
        if (r.course_id) reqCatMap.set(r.course_id, r.category);
      }
    }

    for (const cid of majorCourseIds) {
      const c = courseMap.get(cid);
      if (!c) continue;
      if (deptFilter.size > 0 && !deptFilter.has(c.department_prefix)) continue;
      nodeMap.set(c.id, {
        id: c.id, prefix: c.department_prefix, number: c.course_number,
        title: c.title, credits: c.credits, inMajor: true,
        category: reqCatMap.get(c.id), description: c.description || undefined,
      });
    }

    for (const rel of allPrereqs) {
      if (!rel.prerequisite_id) continue;
      if (!nodeMap.has(rel.course_id)) continue;

      const isCoreq = rel.relationship_type === "corequisite";
      if (isCoreq && !showCoreqs) continue;

      const edgeKey = `${rel.prerequisite_id}-${rel.course_id}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      if (rel.prerequisite && !nodeMap.has(rel.prerequisite_id)) {
        if (!showExternalPrereqs) continue;
        const pre = rel.prerequisite as any;
        if (deptFilter.size > 0 && !deptFilter.has(pre.department_prefix)) continue;
        nodeMap.set(pre.id, {
          id: pre.id, prefix: pre.department_prefix, number: pre.course_number,
          title: pre.title, credits: pre.credits, inMajor: false,
        });
      }

      if (!nodeMap.has(rel.prerequisite_id)) continue;

      if (isCoreq) coreqEdges++; else prereqEdges++;

      const preColor = rel.prerequisite ? getDeptColor((rel.prerequisite as any).department_prefix) : "#999";
      const isOnPath = foundPath.has(rel.prerequisite_id) && foundPath.has(rel.course_id);

      edgeList.push({
        id: `e-${edgeKey}`,
        source: rel.prerequisite_id,
        target: rel.course_id,
        animated: isOnPath || !isCoreq,
        label: isCoreq ? "CO-REQ" : undefined,
        labelStyle: { fontSize: 9, fontWeight: 700, fill: isCoreq ? "#e05555" : undefined },
        labelBgStyle: { fill: "white", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: isOnPath ? "#22c55e" : preColor },
        style: {
          stroke: isOnPath ? "#22c55e" : preColor,
          strokeWidth: isOnPath ? 3.5 : isCoreq ? 1.5 : 2,
          strokeDasharray: isCoreq ? "6 3" : undefined,
        },
      });
    }

    const nodeArray = Array.from(nodeMap.values());
    const levels = new Map<number, NodeInfo[]>();
    for (const n of nodeArray) {
      const lvl = getCourseLevel(n.number);
      if (!levels.has(lvl)) levels.set(lvl, []);
      levels.get(lvl)!.push(n);
    }
    for (const [, group] of levels) {
      group.sort((a, b) => a.prefix.localeCompare(b.prefix) || a.number.localeCompare(b.number));
    }

    const sortedLevels = Array.from(levels.keys()).sort();
    const NODE_W = layoutDir === "TB" ? 200 : 220;
    const NODE_H = 60;
    const GAP_X = layoutDir === "TB" ? 28 : 180;
    const GAP_Y = layoutDir === "TB" ? 150 : 90;

    const deptSet = new Set<string>();
    const nodes: Node[] = [];

    for (let li = 0; li < sortedLevels.length; li++) {
      const group = levels.get(sortedLevels[li])!;
      const totalSize = layoutDir === "TB"
        ? group.length * NODE_W + (group.length - 1) * GAP_X
        : group.length * NODE_H + (group.length - 1) * GAP_Y;
      const startPos = -totalSize / 2;

      for (let ri = 0; ri < group.length; ri++) {
        const n = group[ri];
        deptSet.add(n.prefix);
        const color = getDeptColor(n.prefix);
        const isHovered = hoveredNode === n.id;
        const transitiveSet = hoveredNode ? getTransitiveConnections(hoveredNode) : null;
        const isConnected = transitiveSet?.has(n.id) ?? false;
        const isOnPathNode = foundPath.has(n.id);
        const dimmed = (hoveredNode && !isHovered && !isConnected) || (foundPath.size > 0 && !isOnPathNode);

        const x = layoutDir === "TB"
          ? startPos + ri * (NODE_W + GAP_X)
          : li * (NODE_W + GAP_X);
        const y = layoutDir === "TB"
          ? li * GAP_Y
          : startPos + ri * (NODE_H + GAP_Y);

        const catLabel = n.category?.replace(/_/g, " ");
        const nodeColor = isOnPathNode ? "#22c55e" : color;

        nodes.push({
          id: n.id,
          position: { x, y },
          data: {
            label: (
              <div
                style={{
                  width: NODE_W,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `2px solid ${isHovered || isOnPathNode ? nodeColor : n.inMajor ? color + "60" : "#ccc"}`,
                  background: isHovered
                    ? `${color}22`
                    : isOnPathNode ? "#22c55e18" : n.inMajor ? `${color}0a` : "#f8f8f8",
                  boxShadow: isHovered
                    ? `0 4px 24px ${color}35`
                    : isOnPathNode ? "0 4px 20px rgba(34,197,94,0.25)" : n.inMajor ? "0 1px 4px rgba(0,0,0,0.05)" : "none",
                  opacity: dimmed ? 0.15 : n.inMajor ? 1 : 0.55,
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{
                    fontFamily: "'Space Grotesk', monospace", fontSize: 12, fontWeight: 700, color,
                    letterSpacing: "0.02em",
                  }}>
                    {n.prefix} {n.number}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {isOnPathNode && <span style={{ fontSize: 10 }}>🟢</span>}
                    {n.credits != null && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: "white",
                        background: color, borderRadius: 4, padding: "1px 5px",
                      }}>
                        {n.credits}cr
                      </span>
                    )}
                  </div>
                </div>
                <div style={{
                  fontSize: 10, color: "#666", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {n.title}
                </div>
                {showCategories && catLabel && (
                  <div style={{
                    marginTop: 4, fontSize: 8, padding: "1px 6px",
                    borderRadius: 3, background: `${color}15`, color,
                    display: "inline-block", fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}>
                    {catLabel}
                  </div>
                )}
              </div>
            ),
          },
          sourcePosition: layoutDir === "TB" ? Position.Bottom : Position.Right,
          targetPosition: layoutDir === "TB" ? Position.Top : Position.Left,
        });
      }
    }

    return {
      nodes,
      edges: edgeList,
      stats: { total: nodeMap.size, prereqEdges, coreqEdges, depts: deptSet.size },
    };
  }, [majorCourseIds, allPrereqs, allCourses, requirements, hoveredNode, getTransitiveConnections, layoutDir, showExternalPrereqs, showCoreqs, showCategories, deptFilter, foundPath]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graphData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphData.edges);

  useEffect(() => {
    setNodes(graphData.nodes);
    setEdges(graphData.edges);
  }, [graphData, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (pathFinderOpen) {
      if (!pathStart) {
        setPathStart(node.id);
      } else if (!pathEnd) {
        setPathEnd(node.id);
      } else {
        setPathStart(node.id);
        setPathEnd(null);
      }
      return;
    }
    const course = allCourses?.find(c => c.id === node.id);
    if (course) setSelectedNodeInfo(course);
  }, [allCourses, pathFinderOpen, pathStart, pathEnd]);

  const onNodeMouseEnter = useCallback((_: any, node: Node) => {
    if (!pathFinderOpen) setHoveredNode(node.id);
  }, [pathFinderOpen]);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const toggleDeptFilter = (dept: string) => {
    setDeptFilter(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  const focusOnNode = useCallback((courseId: string) => {
    const node = graphData.nodes.find(n => n.id === courseId);
    if (node && reactFlowInstance) {
      reactFlowInstance.setCenter(node.position.x + 100, node.position.y + 30, { zoom: 1.5, duration: 600 });
      setSelectedNodeInfo(allCourses?.find(c => c.id === courseId) || null);
    }
    setSearchOpen(false);
    setSearchQuery("");
  }, [graphData.nodes, reactFlowInstance, allCourses]);

  const handleExportPng = useCallback(async () => {
    const el = document.querySelector(".react-flow") as HTMLElement;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, { backgroundColor: "#faf9f6", pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `${selectedProgram?.code || "prereq"}-graph.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  }, [selectedProgram]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const coursesForPathPicker = useMemo(() => {
    if (!allCourses) return [];
    return allCourses
      .filter(c => graphData.nodes.some(n => n.id === c.id))
      .sort((a, b) => `${a.department_prefix} ${a.course_number}`.localeCompare(`${b.department_prefix} ${b.course_number}`));
  }, [allCourses, graphData.nodes]);

  const getCourseName = (id: string | null) => {
    if (!id || !allCourses) return "Click a node...";
    const c = allCourses.find(c => c.id === id);
    return c ? `${c.department_prefix} ${c.course_number}` : id;
  };

  return (
    <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-[100] bg-background" : "h-screen"}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex flex-col md:flex-row md:items-center gap-2 bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg gold-gradient flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-sm leading-tight">Prerequisite Graph</h1>
            <p className="text-[9px] text-muted-foreground">Visualize course dependency chains</p>
          </div>
        </div>

        <Select value={selectedProgram?.id || ""} onValueChange={(val) => setSelectedProgramId(val)}>
          <SelectTrigger className="w-full md:w-56 h-8 text-xs">
            <SelectValue placeholder="Select a major..." />
          </SelectTrigger>
          <SelectContent>
            {programs?.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className="font-mono text-xs font-semibold mr-2">{p.code}</span>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="hidden md:block">
          <TabsList className="h-7">
            <TabsTrigger value="graph" className="text-[10px] h-5 px-2"><GitBranch className="w-3 h-3 mr-1" />Graph</TabsTrigger>
            <TabsTrigger value="critical" className="text-[10px] h-5 px-2"><Calendar className="w-3 h-3 mr-1" />Critical Path</TabsTrigger>
            <TabsTrigger value="stats" className="text-[10px] h-5 px-2"><BarChart3 className="w-3 h-3 mr-1" />Stats</TabsTrigger>
            <TabsTrigger value="planner" className="text-[10px] h-5 px-2"><GraduationCap className="w-3 h-3 mr-1" />4-Year Plan</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Search */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]">
                <Search className="w-3 h-3 mr-1" /> Find
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-7 text-xs mb-2"
                autoFocus
              />
              <ScrollArea className="max-h-48">
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2 transition-colors"
                    onClick={() => focusOnNode(c.id)}
                  >
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: getDeptColor(c.department_prefix) }} />
                    <span className="font-mono font-semibold">{c.department_prefix} {c.course_number}</span>
                    <span className="text-muted-foreground truncate">{c.title}</span>
                  </button>
                ))}
                {searchQuery && searchResults.length === 0 && (
                  <p className="text-[10px] text-muted-foreground p-2">No courses found</p>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Path Finder */}
          <Button
            variant={pathFinderOpen ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={() => {
              setPathFinderOpen(!pathFinderOpen);
              if (pathFinderOpen) {
                setFoundPath(new Set());
                setPathStart(null);
                setPathEnd(null);
              }
            }}
          >
            <Route className="w-3 h-3 mr-1" /> Path
          </Button>

          {/* Layout Direction */}
          <div className="hidden md:flex items-center gap-0.5 bg-muted rounded-md p-0.5">
            <Button variant={layoutDir === "TB" ? "default" : "ghost"} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setLayoutDir("TB")}>
              <ArrowDown className="w-3 h-3" />
            </Button>
            <Button variant={layoutDir === "LR" ? "default" : "ghost"} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setLayoutDir("LR")}>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {/* Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]">
                <Filter className="w-3 h-3 mr-1" /> Filters
                {deptFilter.size > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{deptFilter.size}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <p className="text-xs font-semibold mb-2">Display Options</p>
              <div className="space-y-2.5 mb-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">External prereqs</Label>
                  <Switch checked={showExternalPrereqs} onCheckedChange={setShowExternalPrereqs} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Corequisites</Label>
                  <Switch checked={showCoreqs} onCheckedChange={setShowCoreqs} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Category labels</Label>
                  <Switch checked={showCategories} onCheckedChange={setShowCategories} />
                </div>
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground">Filter by Department</p>
                <div className="space-y-1.5">
                  {availableDepts.map(dept => (
                    <label key={dept} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={deptFilter.size === 0 || deptFilter.has(dept)}
                        onCheckedChange={() => toggleDeptFilter(dept)}
                      />
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getDeptColor(dept) }} />
                      <span className="text-[11px] font-mono font-medium">{dept}</span>
                    </label>
                  ))}
                  {deptFilter.size > 0 && (
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => setDeptFilter(new Set())}>
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export */}
          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={handleExportPng}>
            <Download className="w-3 h-3 mr-1" /> PNG
          </Button>

          {/* Fullscreen */}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </Button>

          {/* Legend */}
          <div className="hidden xl:flex gap-2 items-center border-l border-border pl-2 ml-1">
            {Object.entries(DEPT_COLORS).filter(([d]) => availableDepts.includes(d)).map(([dept, color]) => (
              <span key={dept} className="text-[9px] font-mono flex items-center gap-1 font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} /> {dept}
              </span>
            ))}
          </div>

          {graphData.stats.total > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 text-[9px] text-muted-foreground border-l border-border pl-2 ml-1">
              <span>{graphData.stats.total} courses</span>
              <span>·</span>
              <span>{graphData.stats.prereqEdges + graphData.stats.coreqEdges} links</span>
            </div>
          )}
        </div>
      </div>

      {/* Path Finder Bar */}
      {pathFinderOpen && (
        <div className="px-3 py-2 bg-accent/50 border-b border-border flex items-center gap-3 shrink-0">
          <Route className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground">Path Finder</span>
          <span className="text-[10px] text-muted-foreground">Click two nodes to find the prerequisite path between them</span>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">
              {getCourseName(pathStart)} → {getCourseName(pathEnd)}
            </Badge>
            {foundPath.size > 0 && (
              <Badge className="text-[10px] bg-green-500/20 text-green-700 border-green-300" variant="outline">
                {foundPath.size} courses in path
              </Badge>
            )}
            {pathStart && pathEnd && foundPath.size === 0 && (
              <Badge variant="destructive" className="text-[10px]">No path found</Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setPathStart(null); setPathEnd(null); setFoundPath(new Set()); }}>
              Reset
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setPathFinderOpen(false); setFoundPath(new Set()); setPathStart(null); setPathEnd(null); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {majorCourseIds.size === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <Card className="max-w-md shadow-lg">
            <CardContent className="p-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl gold-gradient mx-auto flex items-center justify-center">
                <GitBranch className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display font-bold text-foreground text-lg">Prerequisite Graph</p>
                <p className="text-sm text-muted-foreground mt-1">Select a major above to visualize the full prerequisite dependency tree</p>
              </div>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground pt-2">
                <div className="flex items-center gap-2"><span className="w-8 h-0.5 bg-primary rounded" /> Solid arrow = prerequisite</div>
                <div className="flex items-center gap-2"><span className="w-8 h-0.5 border-t-2 border-dashed border-destructive" /> Dashed = corequisite</div>
                <div className="flex items-center gap-2"><Layers className="w-3 h-3" /> Grouped by course level</div>
                <div className="flex items-center gap-2"><Search className="w-3 h-3" /> Search & focus on courses</div>
                <div className="flex items-center gap-2"><Route className="w-3 h-3" /> Find path between any two courses</div>
                <div className="flex items-center gap-2"><Download className="w-3 h-3" /> Export graph as PNG</div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : viewMode === "stats" ? (
        /* Stats View */
        <ScrollArea className="flex-1 p-4">
          {statsData && (
            <div className="max-w-4xl mx-auto space-y-4">
              <h2 className="font-display font-bold text-lg text-foreground">{selectedProgram?.name} — Program Statistics</h2>
              
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Courses", value: statsData.totalCourses, icon: BookOpen, color: "text-primary" },
                  { label: "Total Credits", value: statsData.totalCredits, icon: Hash, color: "text-primary" },
                  { label: "With Prerequisites", value: statsData.coursesWithPrereqs, icon: Link2, color: "text-primary" },
                  { label: "Longest Chain", value: statsData.maxChainLength, icon: ChevronsUpDown, color: "text-primary" },
                ].map(kpi => (
                  <Card key={kpi.label}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{kpi.label}</span>
                      </div>
                      <p className="text-2xl font-display font-bold text-foreground">{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Credits by Category */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">Credits by Category</p>
                  <div className="space-y-2">
                    {Object.entries(statsData.catCredits).sort((a, b) => b[1] - a[1]).map(([cat, credits]) => (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-[11px] font-medium capitalize w-28 text-foreground">{cat.replace(/_/g, " ")}</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full gold-gradient flex items-center justify-end pr-2"
                            style={{ width: `${Math.min(100, (credits / statsData.totalCredits) * 100)}%` }}
                          >
                            <span className="text-[9px] font-bold text-primary-foreground">{credits}cr</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Credits by Department */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">Credits by Department</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(statsData.deptCredits).sort((a, b) => b[1] - a[1]).map(([dept, credits]) => (
                      <div key={dept} className="text-center">
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: getDeptColor(dept) }}
                        >
                          {credits}
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-muted-foreground mt-1 block">{dept}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Level Distribution */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">Course Level Distribution</p>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(statsData.levelCounts).map(([lvl, count]) => (
                      <div key={lvl} className="text-center bg-muted/50 rounded-lg p-3">
                        <p className="text-xl font-display font-bold text-foreground">{count}</p>
                        <p className="text-[10px] text-muted-foreground">{LEVEL_LABELS[Number(lvl)]}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>
      ) : viewMode === "planner" ? (
        /* 4-Year Plan View */
        <ScrollArea className="flex-1 p-4">
          <FourYearPlan
            criticalPathData={criticalPathData}
            programName={selectedProgram?.name}
            programCode={selectedProgram?.code}
            onFocusCourse={(id) => {
              setViewMode("graph");
              setTimeout(() => focusOnNode(id), 100);
            }}
          />
        </ScrollArea>
      ) : viewMode === "critical" ? (
        /* Critical Path View */
        <ScrollArea className="flex-1 p-4">
          {criticalPathData ? (
            <div className="max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-lg text-foreground">{selectedProgram?.name} — Critical Path Analysis</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Minimum semesters to complete all courses respecting prerequisite ordering</p>
                </div>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-2 border-primary/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Min Semesters</span>
                    </div>
                    <p className="text-3xl font-display font-bold text-foreground">{criticalPathData.minSemesters}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Avg Credits/Sem</span>
                    </div>
                    <p className="text-3xl font-display font-bold text-foreground">{criticalPathData.avgCreditsPerSem}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Max Credits/Sem</span>
                    </div>
                    <p className="text-3xl font-display font-bold text-foreground">{criticalPathData.maxCreditsPerSem}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Route className="w-4 h-4 text-primary" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Critical Chain</span>
                    </div>
                    <p className="text-3xl font-display font-bold text-foreground">{criticalPathData.criticalSet.size}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Credit Load Bar */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">Credit Load Per Semester</p>
                  <div className="flex items-end gap-2 h-28">
                    {criticalPathData.semesterCredits.map((cr, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-foreground">{cr}</span>
                        <div
                          className="w-full rounded-t-md gold-gradient"
                          style={{ height: `${Math.max(8, (cr / Math.max(...criticalPathData.semesterCredits, 1)) * 80)}px` }}
                        />
                        <span className="text-[9px] text-muted-foreground">S{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Semester Timeline */}
              <div className="space-y-3">
                {criticalPathData.semesters.map((sem, semIdx) => (
                  <Card key={semIdx} className="overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/50 border-b border-border">
                      <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary-foreground">{semIdx + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-display font-bold text-foreground">Semester {semIdx + 1}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {sem.length} courses · {criticalPathData.semesterCredits[semIdx]} credits
                        </p>
                      </div>
                      {criticalPathData.semesterCredits[semIdx] > 18 && (
                        <Badge variant="outline" className="text-[9px] border-destructive text-destructive">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Heavy Load
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {sem.map(course => {
                          const color = getDeptColor(course.prefix);
                          return (
                            <div
                              key={course.id}
                              className="flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors hover:bg-accent/50 cursor-pointer"
                              style={{
                                borderColor: course.isCritical ? color : "hsl(var(--border))",
                                backgroundColor: course.isCritical ? `${color}08` : undefined,
                              }}
                              onClick={() => {
                                setViewMode("graph");
                                setTimeout(() => focusOnNode(course.id), 100);
                              }}
                            >
                              <div
                                className="w-2 h-8 rounded-full shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-mono font-bold" style={{ color }}>
                                    {course.prefix} {course.number}
                                  </span>
                                  {course.isCritical && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
                                      critical
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">{course.title}</p>
                              </div>
                              <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                                {course.credits || 3}cr
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {criticalPathData.unscheduled.length > 0 && (
                  <Card className="border-destructive/30">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/5 border-b border-destructive/20">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      <div>
                        <p className="text-xs font-display font-bold text-destructive">Unschedulable Courses</p>
                        <p className="text-[10px] text-muted-foreground">Circular dependencies or missing prerequisite data</p>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {criticalPathData.unscheduled.map(course => (
                          <div key={course.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-destructive/20">
                            <div className="w-2 h-8 rounded-full bg-destructive/40 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-mono font-bold text-destructive">{course.prefix} {course.number}</span>
                              <p className="text-[10px] text-muted-foreground truncate">{course.title}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Legend */}
              <Card>
                <CardContent className="p-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded gold-gradient" />
                    <span>Semester number indicates earliest possible scheduling</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">critical</span>
                    <span>Courses on the longest dependency chain</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                    <span>Click any course to view it in the graph</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Select a major to see its critical path analysis
            </div>
          )}
        </ScrollArea>
      ) : (
        /* Graph View */
        <div className="flex-1 relative" ref={graphRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onPaneClick={() => { setSelectedNodeInfo(null); }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.08}
            maxZoom={2.5}
            defaultEdgeOptions={{ type: "smoothstep" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="hsl(40 10% 88%)" gap={24} size={1.5} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => {
                if (foundPath.has(n.id)) return "#22c55e";
                const course = allCourses?.find(c => c.id === n.id);
                return course ? getDeptColor(course.department_prefix) : "#ccc";
              }}
              maskColor="rgba(245,243,238,0.8)"
              style={{ borderRadius: 8, border: "1px solid hsl(40 10% 85%)" }}
            />

            <Panel position="bottom-left">
              <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-[10px] text-muted-foreground space-y-1 shadow-sm">
                <p className="font-display font-semibold text-foreground text-xs mb-1.5">{selectedProgram?.name}</p>
                {Object.entries(LEVEL_LABELS).map(([lvl, label]) => (
                  <div key={lvl} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary/60" />
                    <span>{label}</span>
                  </div>
                ))}
                <div className="border-t border-border mt-1.5 pt-1.5 flex items-center gap-2">
                  <span className="w-5 h-0.5 bg-primary rounded" />
                  <span>Prereq</span>
                  <span className="w-5 h-0.5 border-t border-dashed border-destructive" />
                  <span>Coreq</span>
                </div>
              </div>
            </Panel>
          </ReactFlow>

          {/* Course Info Panel */}
          {selectedNodeInfo && !pathFinderOpen && (
            <div className="absolute top-2 right-2 w-80 z-50 animate-in slide-in-from-right-2">
              <Card className="shadow-xl border-2" style={{ borderColor: getDeptColor(selectedNodeInfo.department_prefix) + "60" }}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      style={{
                        backgroundColor: getDeptColor(selectedNodeInfo.department_prefix) + "20",
                        color: getDeptColor(selectedNodeInfo.department_prefix),
                        borderColor: getDeptColor(selectedNodeInfo.department_prefix) + "40",
                      }}
                      variant="outline"
                      className="font-mono text-xs font-bold"
                    >
                      {selectedNodeInfo.department_prefix} {selectedNodeInfo.course_number}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{selectedNodeInfo.credits} credits</span>
                  </div>
                  <p className="font-display font-semibold text-sm">{selectedNodeInfo.title}</p>
                  {selectedNodeInfo.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                      {selectedNodeInfo.description}
                    </p>
                  )}

                  {allPrereqs && (() => {
                    const prereqs = allPrereqs.filter(p => p.course_id === selectedNodeInfo.id && p.prerequisite_id);
                    const dependents = allPrereqs.filter(p => p.prerequisite_id === selectedNodeInfo.id);
                    return (
                      <>
                        {prereqs.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">✓ No prerequisites</p>
                        ) : (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Prerequisites:</p>
                            <div className="flex flex-wrap gap-1">
                              {prereqs.map(p => {
                                const pre = p.prerequisite as any;
                                return (
                                  <Badge key={p.prerequisite_id} variant="secondary" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => pre && focusOnNode(pre.id)}>
                                    {pre ? `${pre.department_prefix} ${pre.course_number}` : p.prerequisite_text}
                                    {p.relationship_type === "corequisite" && " (co-req)"}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {dependents.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Unlocks:</p>
                            <div className="flex flex-wrap gap-1">
                              {dependents.slice(0, 8).map(d => {
                                const c = d.course as any;
                                return (
                                  <Badge key={d.course_id} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => c && focusOnNode(c.id)}>
                                    {c ? `${c.department_prefix} ${c.course_number}` : "?"}
                                  </Badge>
                                );
                              })}
                              {dependents.length > 8 && <Badge variant="outline" className="text-[10px]">+{dependents.length - 8} more</Badge>}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate(`/course/${selectedNodeInfo.id}`)}>
                      View Details
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedNodeInfo(null)}>
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PrereqGraph = () => (
  <ReactFlowProvider>
    <PrereqGraphInner />
  </ReactFlowProvider>
);

export default PrereqGraph;
