import { useState, useMemo } from "react";
import { Download, ChevronUp, ChevronDown } from "lucide-react";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  numeric?: boolean;
}

interface StatisticsTableProps {
  title?: string;
  data?: Array<Record<string, any>>;
  columns?: Column[];
  sortable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  pageSize?: number;
}

type SortOrder = 'asc' | 'desc' | null;

export default function StatisticsTable({
  title = "Statistics",
  data = [],
  columns = [
    { key: "name", label: "Name" },
    { key: "count", label: "Count", numeric: true },
  ],
  sortable = true,
  filterable = true,
  exportable = true,
  pageSize = 25,
}: StatisticsTableProps) {
  const [filterText, setFilterText] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Filter data
  const filteredData = useMemo(() => {
    if (!filterText) return data;
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(filterText.toLowerCase())
      )
    );
  }, [data, filterText]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortOrder) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortOrder === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [filteredData, sortColumn, sortOrder]);

  // Paginate
  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (colKey: string) => {
    if (!sortable) return;

    if (sortColumn === colKey) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else if (sortOrder === "desc") {
        setSortColumn(null);
        setSortOrder(null);
      }
    } else {
      setSortColumn(colKey);
      setSortOrder("asc");
    }
    setCurrentPage(0);
  };

  const handleExport = () => {
    if (sortedData.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = columns.map((c) => c.label);
    const csvContent = [
      headers.join(","),
      ...sortedData.map((row) =>
        columns
          .map((col) => {
            const value = row[col.key];
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
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderSortIcon = (colKey: string) => {
    if (!sortable || sortColumn !== colKey) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        {exportable && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
      </div>

      {/* Filter Input */}
      {filterable && (
        <input
          type="text"
          placeholder="Filter data..."
          value={filterText}
          onChange={(e) => {
            setFilterText(e.target.value);
            setCurrentPage(0);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-2 text-left font-semibold ${
                    col.numeric ? "text-right" : ""
                  } ${sortable ? "cursor-pointer hover:bg-gray-100" : ""}`}
                >
                  {col.label}
                  {renderSortIcon(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-gray-50"
                  style={{
                    backgroundColor: idx % 2 === 0 ? "transparent" : "#f9fafb",
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2 text-gray-700 ${
                        col.numeric ? "text-right" : ""
                      }`}
                    >
                      {row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-4 text-center text-gray-500"
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-gray-600">
            Showing {currentPage * pageSize + 1}–
            {Math.min((currentPage + 1) * pageSize, sortedData.length)} of{" "}
            {sortedData.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
