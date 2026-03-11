import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SidebarLayout from "@/components/SidebarLayout";
import { apiUrl } from "@/lib/apiBase";
import { projects } from "@/lib/sampleData";

export default function DebugProjects() {
  const [apiStatus, setApiStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAPI = async () => {
      const status: Record<string, any> = {};

      for (const project of projects) {
        try {
          const response = await fetch(
            apiUrl(`/iclassifier/${project.id}/full?_t=${Date.now()}`)
          );
          const data = await response.json();

          status[project.id] = {
            available: true,
            lemmasCount: Object.keys(data.lemmas || {}).length,
            tokensCount: Object.keys(data.tokens || {}).length,
            witnessesCount: Object.keys(data.witnesses || {}).length,
            classifiersCount: (data.classifiers || []).length,
          };
        } catch (error) {
          status[project.id] = {
            available: false,
            error: (error as Error).message,
          };
        }
      }

      setApiStatus(status);
      setLoading(false);
    };

    checkAPI();
  }, []);

  return (
    <SidebarLayout>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Debug: Project Status</h1>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Defined Projects</h2>
          <p className="text-gray-600 mb-3">Found {projects.length} projects</p>

          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-3 border rounded-lg bg-white shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{project.name}</h3>
                    <p className="text-gray-600 text-sm">{project.description}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {project.id}
                  </span>
                </div>

                <div className="text-sm text-gray-500 mb-3">
                  Type: <span className="font-mono">{project.type}</span>
                </div>

                {/* API Status */}
                {loading ? (
                  <p className="text-gray-500 text-sm">Checking API...</p>
                ) : apiStatus[project.id]?.available ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-green-800 font-semibold mb-2">✅ Data Loaded</p>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>
                        Lemmas: {apiStatus[project.id].lemmasCount} items
                      </li>
                      <li>
                        Tokens: {apiStatus[project.id].tokensCount} items
                      </li>
                      <li>
                        Witnesses: {apiStatus[project.id].witnessesCount} items
                      </li>
                      <li>
                        Classifiers:{" "}
                        {apiStatus[project.id].classifiersCount} items
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800 font-semibold">❌ Not Available</p>
                    <p className="text-sm text-red-700 mt-1">
                      {apiStatus[project.id]?.error || "Database file not found"}
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      Expected: ./data/projects/{project.id}.db
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-bold text-blue-900 mb-2">📋 What This Shows</h3>
          <ul className="text-sm text-blue-900 space-y-1">
            <li>✅ Green = Database loaded successfully</li>
            <li>❌ Red = Database file missing or error</li>
            <li>Each project should show data counts</li>
          </ul>
        </div>

        {/* Link back */}
        <div className="mt-6">
          <Link to="/" className="text-blue-600 hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </SidebarLayout>
  );
}
