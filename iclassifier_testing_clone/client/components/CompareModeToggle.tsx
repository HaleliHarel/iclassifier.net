import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { projects } from "@/lib/sampleData";
import { useCurrentProjectId } from "@/lib/projectContext";

export default function CompareModeToggle() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const navigate = useNavigate();
  const location = useLocation();
  const currentProjectId = useCurrentProjectId();

  // Check if we're in compare mode
  const isCompareModeActive = location.pathname.match(/^\/compare\/[^/]+\/[^/]+/);
  if (isCompareModeActive) {
    return null;
  }

  const handleButtonClick = () => {
    if (isCompareModeActive) {
      // If in compare mode, quit and return to the reports homepage
      navigate("/reports");
    } else {
      // If not in compare mode, open the dialog to select project
      setIsDialogOpen(true);
    }
  };

  const handleOpenCompareMode = () => {
    if (!selectedProjectId || !currentProjectId) return;

    // Navigate to comparison page with both projects using the new URL format
    navigate(`/compare/${currentProjectId}/${selectedProjectId}`);

    setIsDialogOpen(false);
    setSelectedProjectId("");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleButtonClick}
        className={`text-xs font-semibold ${
          isCompareModeActive
            ? "text-red-700 border-red-700 hover:bg-red-50"
            : "text-green-700 border-green-700 hover:bg-green-50"
        }`}
      >
        {isCompareModeActive ? "Quit compare mode" : "Compare Mode"}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compare Mode</DialogTitle>
            <DialogDescription>
              Select a project to compare side-by-side with the current one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select project to compare:</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenCompareMode}
              disabled={!selectedProjectId || !currentProjectId}
            >
              Open in Split Screen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
