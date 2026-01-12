type NetworkInstance = {
  canvas?: {
    frame?: {
      canvas?: HTMLCanvasElement;
    };
  };
  body?: {
    container?: HTMLElement;
  };
};

export function downloadNetworkJPEG(
  network: NetworkInstance | null | undefined,
  dpi: 96 | 300,
  filename: string
) {
  const canvas = network?.canvas?.frame?.canvas;
  if (!canvas) return;

  const scale = dpi / 96;
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.floor(canvas.width * scale));
  output.height = Math.max(1, Math.floor(canvas.height * scale));

  const ctx = output.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(canvas, 0, 0, output.width, output.height);
  const url = output.toDataURL("image/jpeg", 0.95);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
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

export function downloadCanvasPNG(
  canvas: HTMLCanvasElement | null | undefined,
  dpi: 96 | 300,
  filename: string
) {
  if (!canvas) return;
  const scale = dpi / 96;
  const background = getCanvasBackground(canvas);
  const output = renderCanvasToOutput(canvas, scale, background);
  if (!output) return;
  const url = output.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
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

export function downloadNetworkPNG(
  network: NetworkInstance | null | undefined,
  dpi: 96 | 300,
  filename: string
) {
  const canvas = network?.canvas?.frame?.canvas;
  downloadCanvasPNG(canvas, dpi, filename);
}

export function downloadNetworkSVG(
  network: NetworkInstance | null | undefined,
  filename: string
) {
  const canvas = network?.canvas?.frame?.canvas;
  downloadCanvasSVG(canvas, filename);
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
