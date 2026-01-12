import { useState, useMemo } from "react";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { tokenData, lemmaData, witnessData } from "@/lib/sampleData";

interface TokenViewerProps {
  tokens?: number[];
  showLemma?: boolean;
  showWitness?: boolean;
  showClassifiers?: boolean;
  rowsPerPage?: number;
  exportable?: boolean;
}

export default function TokenViewer({
  tokens = Object.keys(tokenData).map(k => parseInt(k)),
  showLemma = true,
  showWitness = true,
  showClassifiers = true,
  rowsPerPage = 20,
  exportable = true,
}: TokenViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const tokensList = useMemo(() => {
    return tokens.map(id => tokenData[id]).filter(Boolean);
  }, [tokens]);

  const paginatedTokens = useMemo(() => {
    const start = currentPage * rowsPerPage;
    const end = start + rowsPerPage;
    return tokensList.slice(start, end);
  }, [tokensList, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(tokensList.length / rowsPerPage);

  const handleExport = () => {
    const exportData = tokensList.map((token) => ({
      "Token ID": token.id,
      ...(showLemma && lemmaData[token.lemma_id] && {
        Lemma: lemmaData[token.lemma_id].transliteration,
        Meaning: lemmaData[token.lemma_id].meaning,
      }),
      MDC: token.mdc || "",
      ...(showWitness && { Witness: token.witness_id || "" }),
      ...(showClassifiers && { "MDC with Classifiers": token.mdc_w_markup || "" }),
    }));

    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row];
            if (typeof value === "string" && value.includes(",")) {
              return `"${value}"`;
            }
            return value || "";
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tokens-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Token Viewer</h3>
        {exportable && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Token ID</th>
              {showLemma && (
                <>
                  <th className="px-4 py-2 text-left font-semibold">Lemma</th>
                  <th className="px-4 py-2 text-left font-semibold">Meaning</th>
                </>
              )}
              <th className="px-4 py-2 text-left font-semibold">MDC</th>
              {showWitness && (
                <th className="px-4 py-2 text-left font-semibold">Witness</th>
              )}
              {showClassifiers && (
                <th className="px-4 py-2 text-left font-semibold">Classifiers</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedTokens.map((token) => {
              const lemma = token.lemma_id ? lemmaData[token.lemma_id] : null;
              return (
                <tr key={token.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{token.id}</td>
                  {showLemma && (
                    <>
                      <td className="px-4 py-2 text-gray-700">
                        <em className="italic">{lemma?.transliteration || "—"}</em>
                      </td>
                      <td className="px-4 py-2 text-gray-700 text-sm">
                        {lemma?.meaning || "—"}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2 text-gray-700 font-mono text-xs">
                    {token.mdc || "—"}
                  </td>
                  {showWitness && (
                    <td className="px-4 py-2 text-gray-700">{token.witness_id || "—"}</td>
                  )}
                  {showClassifiers && (
                    <td className="px-4 py-2 text-gray-700 font-mono text-xs">
                      {token.mdc_w_markup || "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600">
            Page {currentPage + 1} of {totalPages} ({tokensList.length} total tokens)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
