import { Download, Printer, Share2 } from "lucide-react";
import {
  exportAsPDF,
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

  return (
    <div className="report-actions flex flex-wrap gap-4 justify-center">
      <button
        onClick={handleExportPDF}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
        title="Save this report as PDF"
      >
        <Download className="w-4 h-4" />
        Save as PDF
      </button>

      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
        title="Print this report"
      >
        <Printer className="w-4 h-4" />
        Print
      </button>

      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-md hover:shadow-lg"
        title="Copy shareable link to clipboard"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
    </div>
  );
}
