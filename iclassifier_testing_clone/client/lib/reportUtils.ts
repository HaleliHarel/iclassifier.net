import { toast } from "sonner";

export interface ReportData {
  type: "lemma" | "classifier" | "query" | "network" | "project";
  projectId: string;
  lemmaId?: number;
  classifierId?: string;
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
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
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
