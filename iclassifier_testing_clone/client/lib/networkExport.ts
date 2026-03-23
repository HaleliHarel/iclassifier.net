import {
  CLASSIFIER_COOCCURRENCE_EDGE_COLOR,
  JSESH_NODE_COLOR,
  LEMMA_CLASSIFIER_EDGE_COLOR,
  NETWORK_EDGE_ROUNDNESS,
  NETWORK_TEXT_COLOR
} from "./networkUtils";

type NetworkInstance = {
  canvas?: {
    frame?: {
      canvas?: HTMLCanvasElement;
    };
  };
  body?: {
    container?: HTMLElement;
    data?: {
      nodes?: { get?: () => any[] };
      edges?: { get?: () => any[] };
    };
  };
  getPositions?: (nodeIds?: Array<string | number>) => Record<string, { x: number; y: number }>;
  canvasToDOM?: (position: { x: number; y: number }) => { x: number; y: number };
};

const EXPORT_PADDING = 4;
const LEGEND_ROW = 18;
const LEGEND_FONT_SIZE = 12;
const LEGEND_FONT_FAMILY = "sans-serif";
const LEGEND_PADDING = 16;

type LegendItem =
  | { kind: "lemmaNode"; label: string }
  | { kind: "classifierNode"; label: string }
  | { kind: "lemmaEdge"; label: string }
  | { kind: "cooccurEdge"; label: string };

const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
  { kind: "lemmaNode", label: "Lemmas" },
  { kind: "classifierNode", label: "Classifiers" },
  { kind: "lemmaEdge", label: "Lemma-Classifier edges" },
  { kind: "cooccurEdge", label: "Co-occurring classifiers in multiple classification" },
];

function normalizeColor(value: any): string {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function isClassifierNode(node: any): boolean {
  const shape = String(node?.shape || "").toLowerCase();
  if (shape === "box" || shape === "square") return true;
  const background = normalizeColor(node?.color?.background || node?.color);
  return background === normalizeColor(JSESH_NODE_COLOR);
}

function getLegendItems(nodes: any[], edges: any[]): LegendItem[] {
  const hasClassifierNodes = nodes.some((node) => isClassifierNode(node));
  const hasLemmaNodes = nodes.some((node) => !isClassifierNode(node));

  const hasLemmaClassifierEdges = edges.some((edge) => {
    const edgeColor = normalizeColor(edge?.color?.color || edge?.color);
    return edgeColor === normalizeColor(LEMMA_CLASSIFIER_EDGE_COLOR);
  });
  const hasCooccurrenceEdges = edges.some((edge) => {
    const edgeColor = normalizeColor(edge?.color?.color || edge?.color);
    return edgeColor === normalizeColor(CLASSIFIER_COOCCURRENCE_EDGE_COLOR);
  });

  const items: LegendItem[] = [];
  if (hasLemmaNodes) items.push({ kind: "lemmaNode", label: "Lemmas" });
  if (hasClassifierNodes) items.push({ kind: "classifierNode", label: "Classifiers" });

  // For mixed classifier-lemma networks, keep the SVG key focused on entities.
  const isMixedEntityNetwork = hasLemmaNodes && hasClassifierNodes;
  if (!isMixedEntityNetwork) {
    if (hasLemmaClassifierEdges) {
      items.push({ kind: "lemmaEdge", label: "Lemma-Classifier edges" });
    }
    if (hasCooccurrenceEdges) {
      items.push({ kind: "cooccurEdge", label: "Co-occurring classifiers in multiple classification" });
    }
  }

  return items.length > 0 ? items : DEFAULT_LEGEND_ITEMS;
}

function hasImageNodes(network: NetworkInstance): boolean {
  const nodes = network?.body?.data?.nodes?.get?.() || [];
  return nodes.some((node) => {
    const shape = String(node?.shape || "").toLowerCase();
    return shape === "image" || Boolean(node?.image);
  });
}

function measureLegendWidth(ctx: CanvasRenderingContext2D | null, legendItems: LegendItem[]) {
  if (!ctx) {
    return Math.max(...legendItems.map((item) => item.label.length)) * 7;
  }
  ctx.font = `${LEGEND_FONT_SIZE}px ${LEGEND_FONT_FAMILY}`;
  let maxWidth = 0;
  legendItems.forEach((item) => {
    maxWidth = Math.max(maxWidth, ctx.measureText(item.label).width);
  });
  return maxWidth;
}

function computeNetworkBounds(
  nodes: any[],
  nodePositions: Record<string, { x: number; y: number }>,
  fallbackWidth: number,
  fallbackHeight: number,
  measureContext: CanvasRenderingContext2D | null,
  legendItems: LegendItem[]
) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  nodes.forEach((node) => {
    const pos = nodePositions[String(node.id)];
    if (!pos) return;
    const shape = node?.shape || "circle";
    let nodeWidth = 0;
    let nodeHeight = 0;
    const widthConstraint = node?.widthConstraint?.minimum ?? node?.widthConstraint?.maximum;
    const heightConstraint = node?.heightConstraint?.minimum ?? node?.heightConstraint?.maximum;

    if (shape === "box" || shape === "square" || shape === "image") {
      nodeWidth = widthConstraint ?? (node?.size ? node.size * 2 : 80);
      nodeHeight = heightConstraint ?? (node?.size ? node.size * 2 : 44);
    } else {
      const radius = node?.size || 20;
      nodeWidth = radius * 2;
      nodeHeight = radius * 2;
    }

    const halfW = nodeWidth / 2;
    const halfH = nodeHeight / 2;
    minX = Math.min(minX, pos.x - halfW);
    maxX = Math.max(maxX, pos.x + halfW);
    minY = Math.min(minY, pos.y - halfH);
    maxY = Math.max(maxY, pos.y + halfH);

    const label = node?.label;
    if (label && measureContext) {
      const lines = parseLabelLines(label);
      if (lines.length > 0) {
        const fontSize = node?.font?.size || 12;
        const lineHeight = fontSize * LINE_HEIGHT_RATIO;
        let maxLineWidth = 0;
        lines.forEach((line) => {
          if (!line.text) return;
          const width = measureTextWidth(measureContext, line.text, fontSize, node?.font?.face || "sans-serif", line.italic);
          maxLineWidth = Math.max(maxLineWidth, width);
        });
        if (maxLineWidth > 0) {
          const labelHalfW = maxLineWidth / 2;
          const labelHalfH = (lines.length * lineHeight) / 2;
          minX = Math.min(minX, pos.x - labelHalfW);
          maxX = Math.max(maxX, pos.x + labelHalfW);
          minY = Math.min(minY, pos.y - labelHalfH);
          maxY = Math.max(maxY, pos.y + labelHalfH);
        }
      }
    }
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    minX = 0;
    minY = 0;
    maxX = fallbackWidth;
    maxY = fallbackHeight;
  }

  minX -= EXPORT_PADDING;
  minY -= EXPORT_PADDING;
  maxX += EXPORT_PADDING;
  maxY += EXPORT_PADDING;

  const contentMinX = minX;
  const contentMinY = minY;
  const contentMaxX = maxX;
  const contentMaxY = maxY;

  const legendTextWidth = measureLegendWidth(measureContext, legendItems);
  const legendWidth = 26 + legendTextWidth;
  const legendRowCount = Math.max(legendItems.length, 1);
  const legendHeight = LEGEND_ROW * Math.max(0, legendRowCount - 1) + 9;

  let exportMinX = contentMinX;
  let exportMaxX = contentMaxX;
  const contentWidth = exportMaxX - exportMinX;
  const legendAreaWidth = legendWidth + LEGEND_PADDING * 2;
  if (contentWidth < legendAreaWidth) {
    exportMaxX = exportMinX + legendAreaWidth;
  }

  const exportMinY = contentMinY;
  const exportMaxY = contentMaxY + legendHeight + LEGEND_PADDING * 2;

  const legendX = exportMinX + LEGEND_PADDING;
  const legendY = contentMaxY + LEGEND_PADDING + 5;

  return {
    exportMinX,
    exportMinY,
    exportMaxX,
    exportMaxY,
    exportWidth: Math.max(1, Math.round(exportMaxX - exportMinX)),
    exportHeight: Math.max(1, Math.round(exportMaxY - exportMinY)),
    legendX,
    legendY,
    legendItems,
  };
}

function appendLegendSvg(svgParts: string[], legendX: number, legendY: number, legendItems: LegendItem[]) {
  if (legendItems.length === 0) return;
  const legendTextX = legendX + 26;
  const labelStyle = `fill="${NETWORK_TEXT_COLOR}" font-size="${LEGEND_FONT_SIZE}" font-family="${LEGEND_FONT_FAMILY}"`;

  svgParts.push(`<g id="legend">`);
  legendItems.forEach((item, index) => {
    const y = legendY + index * LEGEND_ROW;
    if (item.kind === "lemmaNode") {
      svgParts.push(
        `<circle cx="${legendX + 6}" cy="${y}" r="5" fill="#ffffff" stroke="${NETWORK_TEXT_COLOR}" stroke-width="1" />`
      );
    } else if (item.kind === "classifierNode") {
      svgParts.push(
        `<rect x="${legendX + 1}" y="${y - 6}" width="12" height="10" rx="2" ry="2" fill="${JSESH_NODE_COLOR}" stroke="${JSESH_NODE_COLOR}" stroke-width="1" />`
      );
    } else if (item.kind === "lemmaEdge") {
      svgParts.push(
        `<line x1="${legendX}" y1="${y}" x2="${legendX + 20}" y2="${y}" stroke="${LEMMA_CLASSIFIER_EDGE_COLOR}" stroke-width="3" stroke-linecap="round" />`
      );
    } else if (item.kind === "cooccurEdge") {
      svgParts.push(
        `<line x1="${legendX}" y1="${y}" x2="${legendX + 20}" y2="${y}" stroke="${CLASSIFIER_COOCCURRENCE_EDGE_COLOR}" stroke-width="3" stroke-linecap="round" />`
      );
    }
    svgParts.push(
      `<text x="${legendTextX}" y="${y + 4}" ${labelStyle}>${xmlEscape(item.label)}</text>`
    );
  });
  svgParts.push(`</g>`);
}

export function downloadNetworkJPEG(
  network: NetworkInstance | null | undefined,
  dpi: 96 | 300 = 300,
  filename: string
) {
  if (!network) return;
  const canvas = network?.canvas?.frame?.canvas;
  if (!canvas) return;
  const background = getCanvasBackground(canvas);
  const scale = dpi / 96;
  const svg = buildVectorSvgFromNetwork(network, background, { useCurrentView: false, outputScale: scale });
  const exportFromCanvas = () => {
    const output = renderCanvasToOutput(canvas, scale, background);
    if (!output) return;
    const url = output.toDataURL("image/jpeg", 0.98);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };
  // Vector->bitmap conversion can drop nested image nodes; preserve exact on-screen rendering.
  if (hasImageNodes(network)) {
    exportFromCanvas();
    return;
  }
  if (!svg) {
    exportFromCanvas();
    return;
  }
  downloadBitmapFromSvg(svg, filename, "image/jpeg", exportFromCanvas, 0.98);
}

function getCanvasBackground(canvas: HTMLCanvasElement): string {
  const container = canvas.parentElement;
  if (!container) return "#ffffff";
  const bg = window.getComputedStyle(container).backgroundColor;
  if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") {
    return "#ffffff";
  }
  return bg;
}

function renderCanvasToOutput(
  canvas: HTMLCanvasElement,
  scale: number,
  backgroundColor: string
) {
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.floor(canvas.width * scale));
  output.height = Math.max(1, Math.floor(canvas.height * scale));
  const ctx = output.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.drawImage(canvas, 0, 0, output.width, output.height);
  return output;
}

function addDPItoPNG(pngDataUrl: string, dpi: number): Promise<Blob> {
  return new Promise((resolve) => {
    // Convert base64 to bytes
    const base64Data = pngDataUrl.split(",")[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // DPI to dots per meter conversion (1 inch = 39.3701 mm)
    const dpm = Math.round(dpi * 39.3701);

    // Create pHYs chunk
    // Format: 4 bytes X DPM (big-endian), 4 bytes Y DPM, 1 byte unit (1 = meters)
    const pHYsData = new Uint8Array(9);
    const dpmBytes = new DataView(pHYsData.buffer);
    dpmBytes.setUint32(0, dpm, false); // X DPM (big-endian)
    dpmBytes.setUint32(4, dpm, false); // Y DPM (big-endian)
    pHYsData[8] = 1; // unit (1 = meters)

    // Calculate CRC for pHYs chunk
    const crcData = new Uint8Array(4 + pHYsData.length);
    crcData.set(new Uint8Array([0x70, 0x48, 0x59, 0x73]), 0); // "pHYs"
    crcData.set(pHYsData, 4);
    const crc = calculateCRC(crcData);

    // Build pHYs chunk: length (4) + "pHYs" (4) + data (9) + CRC (4)
    const pHYsChunk = new Uint8Array(4 + 4 + 9 + 4);
    new DataView(pHYsChunk.buffer).setUint32(0, 9, false); // chunk length
    pHYsChunk.set(new Uint8Array([0x70, 0x48, 0x59, 0x73]), 4); // "pHYs"
    pHYsChunk.set(pHYsData, 8);
    new DataView(pHYsChunk.buffer).setUint32(17, crc, false); // CRC

    // Find IHDR chunk (after PNG signature) and insert pHYs after it
    const pngSignature = 8; // PNG signature is 8 bytes
    let insertPos = pngSignature;

    // Skip IHDR chunk (length + "IHDR" + 13 bytes + CRC)
    const ihdrLength = new DataView(bytes.buffer).getUint32(pngSignature, false);
    insertPos += 4 + 4 + ihdrLength + 4; // length + type + data + CRC

    // Create new PNG with pHYs chunk inserted
    const newPng = new Uint8Array(bytes.length + pHYsChunk.length);
    newPng.set(bytes.slice(0, insertPos), 0);
    newPng.set(pHYsChunk, insertPos);
    newPng.set(bytes.slice(insertPos), insertPos + pHYsChunk.length);

    resolve(new Blob([newPng], { type: "image/png" }));
  });
}

function calculateCRC(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function downloadBitmapFromSvg(
  svg: string,
  filename: string,
  mimeType: "image/png" | "image/jpeg",
  fallback: () => void | Promise<void>,
  quality?: number
) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    const output = document.createElement("canvas");
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    output.width = Math.max(1, naturalWidth);
    output.height = Math.max(1, naturalHeight);
    const ctx = output.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      fallback();
      return;
    }
    ctx.drawImage(image, 0, 0, output.width, output.height);
    const dataUrl = mimeType === "image/jpeg"
      ? output.toDataURL(mimeType, quality ?? 0.95)
      : output.toDataURL(mimeType);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    fallback();
  };
  image.src = url;
}

async function downloadCanvasTIFF(
  _canvas: HTMLCanvasElement | null | undefined,
  _dpi: 300,
  _filename: string
) {
  alert("TIFF export is disabled until the UTIF dependency is installed.");
}

export async function downloadCanvasPNG(
  canvas: HTMLCanvasElement | null | undefined,
  dpi: 96 | 300 = 300,
  filename: string
) {
  if (!canvas) return;
  const scale = dpi / 96;
  const background = getCanvasBackground(canvas);
  const output = renderCanvasToOutput(canvas, scale, background);
  if (!output) return;
  const dataUrl = output.toDataURL("image/png");
  const blob = await addDPItoPNG(dataUrl, dpi);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCanvasSVG(
  canvas: HTMLCanvasElement | null | undefined,
  filename: string
) {
  if (!canvas) return;
  const background = getCanvasBackground(canvas);
  const dataUrl = canvas.toDataURL("image/png");
  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
    `<rect width="100%" height="100%" fill="${background}"/>`,
    `<image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/>`,
    `</svg>`
  ].join("");
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseLabelLines(rawLabel: string | null | undefined) {
  if (!rawLabel) return [];
  const label = String(rawLabel)
    .replace(/<br\s*\/>/gi, "\n")
    .replace(/<br\s*>/gi, "\n");
  return label
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      text: line.replace(/<[^>]+>/g, ""),
      italic: /<\s*(i|em)\b/i.test(line)
    }));
}

const LABEL_PADDING = 6;
const CIRCLE_LABEL_PADDING = 2;
const MIN_LABEL_FONT_SIZE = 6;
const LINE_HEIGHT_RATIO = 1.2;

function getLabelBounds(node: any) {
  const shape = node?.shape || "circle";
  const isCircular = shape === "circle" || shape === "dot" || shape === "ellipse";
  const widthConstraint = node?.widthConstraint?.minimum ?? node?.widthConstraint?.maximum;
  const heightConstraint = node?.heightConstraint?.minimum ?? node?.heightConstraint?.maximum;
  let width = 0;
  let height = 0;

  if (shape === "box" || shape === "square" || shape === "image") {
    width = widthConstraint ?? (node?.size ? node.size * 2 : 80);
    height = heightConstraint ?? (node?.size ? node.size * 2 : 44);
  } else {
    const radius = node?.size || 20;
    width = radius * 2;
    height = radius * 2;
  }

  const padding = isCircular ? CIRCLE_LABEL_PADDING : LABEL_PADDING;
  width = Math.max(1, width - padding * 2);
  height = Math.max(1, height - padding * 2);
  return { width, height };
}

function getMeasureContext() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d");
}

function formatCanvasFont(fontSize: number, fontFamily: string, italic: boolean) {
  const normalized = fontFamily?.trim() ? fontFamily.trim() : "sans-serif";
  const needsQuote = normalized.includes(" ") && !normalized.includes(",") && !/^['"]/.test(normalized);
  const family = needsQuote ? `"${normalized}"` : normalized;
  const style = italic ? "italic " : "";
  return `${style}${fontSize}px ${family}`;
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontFamily: string,
  italic: boolean
) {
  ctx.font = formatCanvasFont(fontSize, fontFamily, italic);
  return ctx.measureText(text).width;
}

function getCurvedEdgePath(
  edge: any,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  if (edge?.smooth === false) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 2) return null;

  const smoothConfig = typeof edge?.smooth === "object" ? edge.smooth : null;
  const rawRoundness = Number(smoothConfig?.roundness);
  const roundness = Number.isFinite(rawRoundness)
    ? Math.max(0.08, Math.min(0.32, rawRoundness))
    : NETWORK_EDGE_ROUNDNESS;
  const type = String(smoothConfig?.type || "");
  let direction = String(edge?.from ?? "") <= String(edge?.to ?? "") ? 1 : -1;
  if (type.includes("CW")) direction = -1;
  if (type.includes("CCW")) direction = 1;

  const perpX = -dy / distance;
  const perpY = dx / distance;
  const offset = Math.max(10, Math.min(distance * roundness, 44));
  const controlX = (from.x + to.x) / 2 + perpX * offset * direction;
  const controlY = (from.y + to.y) / 2 + perpY * offset * direction;

  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

function buildVectorSvgFromNetwork(
  network: NetworkInstance,
  backgroundColor: string,
  options?: { useCurrentView?: boolean; outputScale?: number }
) {
  const canvas = network?.canvas?.frame?.canvas;
  if (!canvas) return null;

  const useCurrentView = options?.useCurrentView ?? true;
  const outputScale = Math.max(1, options?.outputScale ?? 1);
  const width = canvas.width;
  const height = canvas.height;
  const nodes = network.body?.data?.nodes?.get?.() || [];
  const edges = network.body?.data?.edges?.get?.() || [];
  const nodeIds = nodes.map((node) => node.id);
  const positions = typeof network.getPositions === "function"
    ? network.getPositions(nodeIds)
    : {};
  const toDom = useCurrentView && typeof network.canvasToDOM === "function"
    ? network.canvasToDOM.bind(network)
    : null;
  const measureContext = getMeasureContext();
  const legendItems = getLegendItems(nodes, edges);

  const nodePositions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node) => {
    const pos = positions[node.id] || (node?.x != null && node?.y != null ? { x: node.x, y: node.y } : null);
    if (!pos) return;
    const domPos = toDom ? toDom(pos) : pos;
    nodePositions[String(node.id)] = domPos;
  });

  const bounds = computeNetworkBounds(nodes, nodePositions, width, height, measureContext, legendItems);
  const outputWidth = Math.max(1, Math.round(bounds.exportWidth * outputScale));
  const outputHeight = Math.max(1, Math.round(bounds.exportHeight * outputScale));

  const svgParts: string[] = [];
  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="${bounds.exportMinX} ${bounds.exportMinY} ${bounds.exportWidth} ${bounds.exportHeight}">`
  );
  svgParts.push(`<rect x="${bounds.exportMinX}" y="${bounds.exportMinY}" width="${bounds.exportWidth}" height="${bounds.exportHeight}" fill="${backgroundColor}"/>`);

  // Edges
  svgParts.push(`<g id="edges">`);
  edges.forEach((edge) => {
    const from = nodePositions[String(edge.from)];
    const to = nodePositions[String(edge.to)];
    if (!from || !to) return;
    const stroke = edge?.color?.color || edge?.color || "#374151";
    const strokeWidth = Math.max(1, edge?.width || 1);
    const dash = edge?.dashes ? ` stroke-dasharray="6 4"` : "";
    const curvedPath = getCurvedEdgePath(edge, from, to);
    if (curvedPath) {
      svgParts.push(
        `<path d="${curvedPath}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${dash} />`
      );
      return;
    }
    svgParts.push(
      `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"${dash} />`
    );
  });
  svgParts.push(`</g>`);

  // Nodes
  svgParts.push(`<g id="nodes">`);
  nodes.forEach((node) => {
    const pos = nodePositions[String(node.id)];
    if (!pos) return;
    const background = node?.color?.background || node?.color || "#ffffff";
    const border = node?.color?.border || NETWORK_TEXT_COLOR;
    const borderWidth = node?.borderWidth || 1;
    const shape = node?.shape || "circle";

    if (shape === "image" && node?.image) {
      const widthConstraint = node?.widthConstraint?.minimum || node?.widthConstraint?.maximum || node?.size || 40;
      const heightConstraint = node?.heightConstraint?.minimum || node?.heightConstraint?.maximum || node?.size || 40;
      const x = pos.x - widthConstraint / 2;
      const y = pos.y - heightConstraint / 2;
      svgParts.push(
        `<image href="${xmlEscape(String(node.image))}" x="${x}" y="${y}" width="${widthConstraint}" height="${heightConstraint}" preserveAspectRatio="xMidYMid meet" />`
      );
      return;
    }

    if (shape === "box" || shape === "square") {
      const widthConstraint = node?.widthConstraint?.minimum || node?.widthConstraint?.maximum || node?.size * 2 || 80;
      const heightConstraint = node?.heightConstraint?.minimum || node?.heightConstraint?.maximum || node?.size * 2 || 44;
      const radius = node?.shapeProperties?.borderRadius || 0;
      const x = pos.x - widthConstraint / 2;
      const y = pos.y - heightConstraint / 2;
      svgParts.push(
        `<rect x="${x}" y="${y}" width="${widthConstraint}" height="${heightConstraint}" rx="${radius}" ry="${radius}" fill="${background}" stroke="${border}" stroke-width="${borderWidth}" />`
      );
      return;
    }

    const radius = node?.size || 20;
    svgParts.push(
      `<circle cx="${pos.x}" cy="${pos.y}" r="${radius}" fill="${background}" stroke="${border}" stroke-width="${borderWidth}" />`
    );
  });
  svgParts.push(`</g>`);

  // Labels
  svgParts.push(`<g id="labels">`);
  nodes.forEach((node) => {
    const pos = nodePositions[String(node.id)];
    if (!pos) return;
    const label = node?.label;
    if (!label) return;
    const lines = parseLabelLines(label);
    if (lines.length === 0) return;
    const baseFontSize = node?.font?.size || 12;
    const fontFamily = node?.font?.face || "sans-serif";
    const fontColor = node?.font?.color || NETWORK_TEXT_COLOR;
    let fontSize = baseFontSize;
    let lineHeight = fontSize * LINE_HEIGHT_RATIO;

    if (measureContext) {
      const bounds = getLabelBounds(node);
      let maxLineWidth = 0;
      lines.forEach((line) => {
        if (!line.text) return;
        const width = measureTextWidth(measureContext, line.text, baseFontSize, fontFamily, line.italic);
        maxLineWidth = Math.max(maxLineWidth, width);
      });
      const totalHeight = lines.length * baseFontSize * LINE_HEIGHT_RATIO;
      if (maxLineWidth > 0 && bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(1, bounds.width / maxLineWidth, bounds.height / totalHeight);
        fontSize = Math.max(MIN_LABEL_FONT_SIZE, Math.round(baseFontSize * scale * 10) / 10);
        lineHeight = fontSize * LINE_HEIGHT_RATIO;
      }
    }

    const startY = pos.y - (lines.length - 1) * lineHeight * 0.5;

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      const style = line.italic ? ` font-style="italic"` : "";
      svgParts.push(
        `<text x="${pos.x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${fontColor}" font-size="${fontSize}" font-family="${xmlEscape(String(fontFamily))}"${style}>${xmlEscape(line.text)}</text>`
      );
    });
  });
  svgParts.push(`</g>`);

  appendLegendSvg(svgParts, bounds.legendX, bounds.legendY, bounds.legendItems);

  svgParts.push(`</svg>`);
  return svgParts.join("");
}

function buildRasterSvgFromNetwork(
  network: NetworkInstance,
  backgroundColor: string
) {
  const canvas = network?.canvas?.frame?.canvas;
  if (!canvas) return null;
  const width = canvas.width;
  const height = canvas.height;
  const nodes = network.body?.data?.nodes?.get?.() || [];
  const edges = network.body?.data?.edges?.get?.() || [];
  const nodeIds = nodes.map((node) => node.id);
  const positions = typeof network.getPositions === "function"
    ? network.getPositions(nodeIds)
    : {};
  const toDom = typeof network.canvasToDOM === "function"
    ? network.canvasToDOM.bind(network)
    : null;
  const measureContext = getMeasureContext();
  const legendItems = getLegendItems(nodes, edges);

  const nodePositions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node) => {
    const pos = positions[node.id] || (node?.x != null && node?.y != null ? { x: node.x, y: node.y } : null);
    if (!pos) return;
    const domPos = toDom ? toDom(pos) : pos;
    nodePositions[String(node.id)] = domPos;
  });

  const bounds = computeNetworkBounds(nodes, nodePositions, width, height, measureContext, legendItems);
  const dataUrl = canvas.toDataURL("image/png");

  const svgParts: string[] = [];
  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.exportWidth}" height="${bounds.exportHeight}" viewBox="${bounds.exportMinX} ${bounds.exportMinY} ${bounds.exportWidth} ${bounds.exportHeight}">`
  );
  svgParts.push(`<rect x="${bounds.exportMinX}" y="${bounds.exportMinY}" width="${bounds.exportWidth}" height="${bounds.exportHeight}" fill="${backgroundColor}"/>`);
  svgParts.push(`<image href="${dataUrl}" x="0" y="0" width="${width}" height="${height}" />`);

  appendLegendSvg(svgParts, bounds.legendX, bounds.legendY, bounds.legendItems);

  svgParts.push(`</svg>`);
  return svgParts.join("");
}

export async function downloadNetworkPNG(
  network: NetworkInstance | null | undefined,
  dpi: 96 | 300 = 300,
  filename: string
) {
  if (!network) return;
  const canvas = network?.canvas?.frame?.canvas;
  if (!canvas) return;
  const background = getCanvasBackground(canvas);
  const scale = dpi / 96;
  // PNG export should match the live canvas output exactly for both 96 and 300 DPI.
  const output = renderCanvasToOutput(canvas, scale, background);
  if (!output) return;
  const dataUrl = output.toDataURL("image/png");
  const blob = await addDPItoPNG(dataUrl, dpi);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadNetworkTIFF(
  _network: NetworkInstance | null | undefined,
  _dpi: 300,
  _filename: string
) {
  alert("TIFF export is disabled until the UTIF dependency is installed.");
}

export function downloadNetworkSVG(
  network: NetworkInstance | null | undefined,
  filename: string
) {
  if (!network) return;
  const canvas = network?.canvas?.frame?.canvas;
  if (!canvas) return;
  const background = getCanvasBackground(canvas);
  const svg = buildRasterSvgFromNetwork(network, background);
  if (!svg) {
    downloadCanvasSVG(canvas, filename);
    return;
  }
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadNetworkSVGVector(
  network: NetworkInstance | null | undefined,
  filename: string
) {
  if (!network) return;
  const canvas = network?.canvas?.frame?.canvas;
  if (!canvas) return;
  if (hasImageNodes(network)) {
    // Keep image-node networks visible by using raster-in-SVG fallback.
    downloadNetworkSVG(network, filename);
    return;
  }
  const background = getCanvasBackground(canvas);
  const svg = buildVectorSvgFromNetwork(network, background, { useCurrentView: false, outputScale: 3.125 });
  if (!svg) {
    downloadCanvasSVG(canvas, filename);
    return;
  }
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildWorksheet(name: string, headers: string[], rows: string[][]) {
  const headerCells = headers
    .map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`)
    .join("");
  const rowXml = rows
    .map(
      (row) =>
        `<Row>${row
          .map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`)
          .join("")}</Row>`
    )
    .join("");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${headerCells}</Row>${rowXml}</Table></Worksheet>`;
}

export function downloadNetworkDataWorkbook(
  nodes: Array<Record<string, any>>,
  edges: Array<Record<string, any>>,
  filename: string
) {
  const nodeHeaders = ["id", "label", "type", "mdc", "shape", "size", "color"];
  const edgeHeaders = ["from", "to", "weight", "width", "color"];
  const nodeRows = nodes.map((node) => [
    String(node.id ?? ""),
    String(node.label ?? ""),
    String(node.type ?? ""),
    String(node.mdc ?? ""),
    String(node.shape ?? ""),
    String(node.size ?? ""),
    typeof node.color === "object" ? JSON.stringify(node.color) : String(node.color ?? "")
  ]);
  const edgeRows = edges.map((edge) => [
    String(edge.from ?? edge.source ?? ""),
    String(edge.to ?? edge.target ?? ""),
    String(edge.weight ?? ""),
    String(edge.width ?? ""),
    typeof edge.color === "object" ? JSON.stringify(edge.color) : String(edge.color ?? "")
  ]);

  const xml = [
    `<?xml version="1.0"?>`,
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`,
    ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`,
    buildWorksheet("nodes", nodeHeaders, nodeRows),
    buildWorksheet("edges", edgeHeaders, edgeRows),
    `</Workbook>`
  ].join("");

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}
