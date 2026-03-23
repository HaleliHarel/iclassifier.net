import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projects } from "@/lib/sampleData";
import SidebarLayout from "@/components/SidebarLayout";

export default function CompareLanding() {
  const [leftProject, setLeftProject] = useState<string>("");
  const [rightProject, setRightProject] = useState<string>("");
  const navigate = useNavigate();

  const handleStartComparison = () => {
    if (!leftProject || !rightProject) {
      alert("Please select both projects");
      return;
    }

    if (leftProject === rightProject) {
      alert("Please select two different projects");
      return;
    }

    navigate(`/compare/${leftProject}/${rightProject}`);
  };

  return (
    <SidebarLayout>
      <div className="mx-auto w-full max-w-6xl px-3 py-8 sm:px-4 lg:px-0">
        <div className="grid gap-10 lg:grid-cols-[1.05fr,0.95fr] lg:items-start">
          <div className="space-y-10 lg:space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">Compare Projects</h1>
              <p className="text-lg text-gray-600">
                View and compare data from two projects side-by-side. Select any two projects to begin.
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold text-blue-900 mb-3">How it works:</h2>
              <ul className="space-y-3 text-blue-800">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold mt-1">1</span>
                  <span>Select two different projects from the dropdowns below</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold mt-1">2</span>
                  <span>Click "Start Comparison" to open the split-view</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold mt-1">3</span>
                  <span>Use the top navigation buttons to switch between different views (Classifier, Lemma, Network, etc.)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold mt-1">4</span>
                  <span>Drag the middle divider to resize the panels as needed</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold mt-1">5</span>
                  <span>Click the X button in either panel to exit comparison mode</span>
                </li>
              </ul>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center space-y-2">
                <div className="text-4xl">𓂽</div>
                <h3 className="font-semibold text-gray-900">Navigate Reports</h3>
                <p className="text-sm text-gray-600">
                  Use top buttons to switch between the reports: Project info, Network, Classifier, Lemma, and Query 
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl">⟷</div>
                <h3 className="font-semibold text-gray-900">Resize Panels</h3>
                <p className="text-sm text-gray-600">
                  Drag the middle divider to adjust panel sizes 
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl">𓁻</div>
                <h3 className="font-semibold text-gray-900">Compare Data</h3>
                <p className="text-sm text-gray-600">
                  See both projects side-by-side for easy comparison and analysis
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Project Selection */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Project */}
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Left Panel Project
                  </label>
                  <Select value={leftProject} onValueChange={setLeftProject}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {leftProject && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: <span className="font-medium">{leftProject}</span>
                    </p>
                  )}
                </div>

                {/* Right Project */}
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Right Panel Project
                  </label>
                  <Select value={rightProject} onValueChange={setRightProject}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {rightProject && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: <span className="font-medium">{rightProject}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleStartComparison}
                  disabled={!leftProject || !rightProject || leftProject === rightProject}
                  size="lg"
                >
                  Start Comparison
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/reports")}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
