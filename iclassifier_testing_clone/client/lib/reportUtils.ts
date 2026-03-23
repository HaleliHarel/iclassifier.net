import { toast } from "sonner";

export interface ReportData {
  type: "lemma" | "classifier" | "query" | "network" | "project";
  projectId: string;
  lemmaId?: number;
  classifierId?: string;
}

declare global {
  interface Window {
    html2canvas?: (
      element: HTMLElement,
      options?: Record<string, unknown>
    ) => Promise<HTMLCanvasElement>;
  }
}

type CanvasSnapshotEntry = {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  originalDisplay: string;
  originalVisibility: string;
  originalPointerEvents: string;
};

const screenshotCanvasStore = new Map<string, CanvasSnapshotEntry[]>();

const HTML2CANVAS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
let html2canvasLoader: Promise<typeof window.html2canvas> | null = null;

async function loadHtml2Canvas(): Promise<NonNullable<typeof window.html2canvas>> {
  if (window.html2canvas) {
    return window.html2canvas;
  }

  if (!html2canvasLoader) {
    html2canvasLoader = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-html2canvas-loader="true"]',
      );

      if (existing) {
        if (window.html2canvas) {
          resolve(window.html2canvas);
          return;
        }
        existing.addEventListener("load", () => {
          if (window.html2canvas) {
            resolve(window.html2canvas);
          } else {
            reject(new Error("PNG export library loaded but not available"));
          }
        });
        existing.addEventListener("error", () => reject(new Error("Failed to load PNG export library")));
        return;
      }

      const script = document.createElement("script");
      script.src = HTML2CANVAS_CDN;
      script.async = true;
      script.dataset.html2canvasLoader = "true";
      script.onload = () => {
        if (window.html2canvas) {
          resolve(window.html2canvas);
        } else {
          reject(new Error("PNG export library loaded but not available"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load PNG export library"));
      document.head.appendChild(script);
    });
  }

  try {
    return await (html2canvasLoader as Promise<NonNullable<typeof window.html2canvas>>);
  } catch (error) {
    html2canvasLoader = null;
    throw error;
  }
}

export function setReportScreenshotMode(elementId: string, enabled: boolean): boolean {
  const root = document.getElementById(elementId);
  if (!root) {
    toast.error("Report element not found");
    return false;
  }

  const existing = screenshotCanvasStore.get(elementId) || [];
  if (enabled && existing.length > 0) {
    return true;
  }
  if (!enabled && existing.length === 0) {
    return false;
  }

  if (!enabled) {
    existing.forEach((entry) => {
      entry.image.remove();
      entry.canvas.style.display = entry.originalDisplay;
      entry.canvas.style.visibility = entry.originalVisibility;
      entry.canvas.style.pointerEvents = entry.originalPointerEvents;
    });
    screenshotCanvasStore.delete(elementId);
    return false;
  }

  const canvases = Array.from(root.querySelectorAll("canvas"));
  const entries: CanvasSnapshotEntry[] = [];

  canvases.forEach((canvas) => {
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    if (!width || !height) return;

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const image = document.createElement("img");
      image.src = dataUrl;
      image.alt = "Screenshot-ready network snapshot";
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      image.style.maxWidth = "100%";
      image.style.display = "block";
      image.style.objectFit = "contain";

      canvas.parentElement?.insertBefore(image, canvas.nextSibling);
      entries.push({
        canvas,
        image,
        originalDisplay: canvas.style.display,
        originalVisibility: canvas.style.visibility,
        originalPointerEvents: canvas.style.pointerEvents,
      });
      canvas.style.display = "none";
      canvas.style.visibility = "hidden";
      canvas.style.pointerEvents = "none";
    } catch {
      // Skip tainted or non-exportable canvases.
    }
  });

  if (entries.length === 0) {
    toast.error("No screenshot-ready canvases found in this report");
    return false;
  }

  screenshotCanvasStore.set(elementId, entries);
  return true;
}

/**
 * Generate a shareable URL for the current report
 */
export function generateShareUrl(data: ReportData): string {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();

  params.set("projectId", data.projectId);
  params.set("type", data.type);

  if (data.lemmaId) {
    params.set("lemmaId", data.lemmaId.toString());
  }
  if (data.classifierId) {
    params.set("classifierId", data.classifierId);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied to clipboard!");
  } catch (err) {
    toast.error("Failed to copy link");
    throw err;
  }
}

/**
 * Trigger browser print dialog
 */
export function printReport(filename: string): void {
  window.print();
}

/**
 * Add DPI metadata to PNG data
 */
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

/**
 * Export the full report area (or full page) as PNG at target DPI.
 */
export async function exportAsPNG(
  filename: string,
  elementId?: string,
  dpi: number = 300
): Promise<void> {
  const hiddenActionBars: Array<{ element: HTMLElement; originalDisplay: string }> = [];
  const backgroundRestores: Array<{ element: HTMLElement; originalBackgroundColor: string }> = [];

  try {
    const html2canvas = await loadHtml2Canvas();
    const reportRoot = elementId
      ? document.getElementById(elementId)
      : null;
    if (elementId && !reportRoot) {
      toast.error("Report element not found");
      return;
    }

    const actionScope: ParentNode = reportRoot || document;
    actionScope.querySelectorAll<HTMLElement>(".report-actions").forEach((element) => {
      hiddenActionBars.push({
        element,
        originalDisplay: element.style.display,
      });
      element.style.display = "none";
    });

    const forceWhiteBackground = (element: HTMLElement | null) => {
      if (!element) return;
      backgroundRestores.push({
        element,
        originalBackgroundColor: element.style.backgroundColor,
      });
      element.style.backgroundColor = "#ffffff";
    };

    forceWhiteBackground(document.documentElement);
    forceWhiteBackground(document.body);
    forceWhiteBackground(reportRoot as HTMLElement | null);

    const scale = Math.max(1, dpi / 96);
    const captureTarget = (reportRoot || document.documentElement) as HTMLElement;

    const canvas = await html2canvas(captureTarget, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowHeight: captureTarget.scrollHeight,
      windowWidth: captureTarget.scrollWidth,
    });

    const pageWidth = canvas.width;
    const pageHeight = canvas.height;
    const dataUrl = canvas.toDataURL("image/png");
    const blob = await addDPItoPNG(dataUrl, dpi);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${pageWidth}x${pageHeight}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success(`${filename}-${pageWidth}x${pageHeight}.png downloaded successfully!`);
  } catch (error) {
    toast.error("Failed to export PNG");
    console.error(error);
  } finally {
    hiddenActionBars.forEach(({ element, originalDisplay }) => {
      element.style.display = originalDisplay;
    });
    backgroundRestores.forEach(({ element, originalBackgroundColor }) => {
      element.style.backgroundColor = originalBackgroundColor;
    });
  }
}

/**
 * Export report as PDF using html2pdf via CDN
 */
export async function exportAsPDF(
  elementId: string,
  filename: string
): Promise<void> {
  try {
    const cleanup = () => {
      document.body.classList.remove("report-exporting");
    };

    // Load html2pdf from CDN if not already loaded
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;

    script.onload = () => {
      const element = document.getElementById(elementId);
      if (!element) {
        toast.error("Report element not found");
        return;
      }

      document.body.classList.add("report-exporting");

      const opt = {
        margin: [6, 6, 6, 6],
        filename: `${filename}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 3,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowHeight: element.scrollHeight,
          windowWidth: element.scrollWidth,
        },
        jsPDF: {
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        },
        pagebreak: {
          mode: ["avoid-all", "css"],
          after: undefined,
        },
      };

      // @ts-ignore - html2pdf is loaded from CDN
      html2pdf()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
          cleanup();
          toast.success(`${filename}.pdf downloaded successfully!`);
        })
        .catch((err: unknown) => {
          cleanup();
          toast.error("Failed to export PDF");
          console.error(err);
        });
    };

    script.onerror = () => {
      cleanup();
      toast.error("Failed to load PDF library");
    };

    document.head.appendChild(script);
  } catch (error) {
    document.body.classList.remove("report-exporting");
    toast.error("Failed to export PDF");
    console.error(error);
  }
}

/**
 * Get report filename based on type and context
 */
export function getReportFilename(
  type: string,
  context?: string
): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `iclassifier-${type}${context ? `-${context}` : ""}-${timestamp}`;
}
