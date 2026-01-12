import { useEffect, useRef } from "react";

interface Node {
  id: string;
  label: string;
  color: string;
  size: number;
  isCenter?: boolean | undefined;
}

interface Edge {
  from: string;
  to: string;
  width: number;
  label?: string;
}

interface NetworkGraphProps {
  nodes: Node[];
  edges: Edge[];
  width?: number;
  height?: number;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

export default function NetworkGraph({
  nodes,
  edges,
  width = 640,
  height = 480,
  canvasRef,
}: NetworkGraphProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const resolvedCanvasRef = canvasRef || internalCanvasRef;

  useEffect(() => {
    if (!resolvedCanvasRef.current || nodes.length === 0) return;

    const canvas = resolvedCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    // Calculate node positions using force-directed layout
    const centerX = width / 2;
    const centerY = height / 2;
    const nodePositions: Record<string, { x: number; y: number }> = {};

    // Place center node
    const centerNode = nodes.find((n) => n.isCenter);
    if (centerNode) {
      nodePositions[centerNode.id] = { x: centerX, y: centerY };
    }

    // Place other nodes in a circle around center
    const otherNodes = nodes.filter((n) => !n.isCenter);
    const radius = Math.min(width, height) / 3;
    otherNodes.forEach((node, index) => {
      const angle = (index / otherNodes.length) * Math.PI * 2;
      nodePositions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Draw edges
    ctx.strokeStyle = "#b0c0ff";
    edges.forEach((edge) => {
      const fromPos = nodePositions[edge.from];
      const toPos = nodePositions[edge.to];
      if (!fromPos || !toPos) return;

      ctx.lineWidth = Math.max(1, Math.min(5, edge.width));
      ctx.beginPath();
      ctx.moveTo(fromPos.x, fromPos.y);
      ctx.lineTo(toPos.x, toPos.y);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((node) => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      const radius = node.size / 2;

      // Draw node circle
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = "#333";
      ctx.font = "11px Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Wrap text if needed
      const words = node.label.split("\n");
      words.forEach((word, i) => {
        const offset = (i - (words.length - 1) / 2) * 12;
        ctx.fillText(word, pos.x, pos.y + offset);
      });
    });
  }, [nodes, edges, width, height, resolvedCanvasRef]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={resolvedCanvasRef}
        width={width}
        height={height}
        className="border border-gray-300 rounded-lg bg-white"
        style={{ maxWidth: "100%", height: "auto" }}
      />
      <div className="flex gap-3">
        <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm">
          Switch background color
        </button>
        <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm">
          Go fullscreen
        </button>
      </div>
    </div>
  );
}
