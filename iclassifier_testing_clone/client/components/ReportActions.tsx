import { Download, Printer, Share2, Camera } from "lucide-react";
import {
  exportAsPDF,
  exportAsPNG,
  copyToClipboard,
  generateShareUrl,
  getReportFilename,
  type ReportData,
} from "@/lib/reportUtils";

interface ReportActionsProps {
  reportId: string;
  reportType: "lemma" | "classifier" | "query" | "network" | "project";
  projectId: string;
  context?: string;
  lemmaId?: number;
  classifierId?: string;
}

export default function ReportActions({
  reportId,
  reportType,
  projectId,
  context,
  lemmaId,
  classifierId,
}: ReportActionsProps) {
  const handlePrint = () => {
    const filename = getReportFilename(reportType, context);
    window.print();
  };

  const handleExportPDF = async () => {
    const filename = getReportFilename(reportType, context);
    await exportAsPDF(reportId, filename);
  };

  const handleShare = async () => {
    const shareData: ReportData = {
      type: reportType,
      projectId,
      lemmaId,
      classifierId,
    };
    const url = generateShareUrl(shareData);
    await copyToClipboard(url);
  };

  const handleExportScreenshot = async () => {
    const filename = getReportFilename(reportType, context);
    await exportAsPNG(filename, reportId, 96);
  };

  return (
    <div className="report-actions flex flex-wrap gap-4 justify-center">
      {/*
        Shared monochrome style for all report action buttons:
        - white background
        - black frame
        - black text
      */}
      <button
        onClick={handleExportPDF}
        className="flex items-center gap-2 px-6 py-2.5 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white transition-colors text-sm font-medium"
        title="Save this report as PDF"
      >
        <Download className="w-4 h-4" />
        Save as PDF
      </button>

      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-6 py-2.5 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white transition-colors text-sm font-medium"
        title="Print this report"
      >
        <Printer className="w-4 h-4" />
        Print
      </button>

      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-6 py-2.5 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white transition-colors text-sm font-medium"
        title="Copy shareable link to clipboard"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      <button
        onClick={handleExportScreenshot}
        className="flex items-center gap-2 px-6 py-2.5 border border-black bg-white text-black rounded-lg hover:bg-black hover:text-white transition-colors text-sm font-medium"
        title="Screenshot report"
      >
        <Camera className="w-4 h-4" />
        Screenshot report 
      </button>
    </div>
  );
}
