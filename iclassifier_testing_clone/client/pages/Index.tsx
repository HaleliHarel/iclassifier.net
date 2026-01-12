import { useNavigate } from "react-router-dom";
import { useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import ProjectCard from "@/components/ProjectCard";
import { combinedEgyptianProject, egyptianProjects, nonEgyptianProjects, projects, Project } from "@/lib/sampleData";
import { Button } from "@/components/ui/button";
import { useProject } from "@/lib/projectContext";
import { extractClassifiersFromString } from "@/lib/networkUtils";
import { useProjectData } from "@/lib/dataProvider";
import { BookOpen } from "lucide-react";
import Citation from "@/components/Citation";
import NetworkLoader from "@/components/NetworkLoader";

export default function Index() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showEgyptianProjects, setShowEgyptianProjects] = useState(false);
  const { setCurrentProject } = useProject();
  const navigate = useNavigate();

  // Load project data when a project is selected
  const { data: projectData, loading: projectLoading, error: projectError } = useProjectData(
    selectedProject || ""
  );

  // Handle project selection - load data and show summary
  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    setCurrentProject(projectId);
  };

  // Navigate to project landing page
  const handleAnalyzeProject = (projectId: string) => {
    navigate(`/project/${projectId}#classifier-repertoire`);
  };

  // Get project info from sampleData
  const getProjectInfo = (projectId: string): Project | null => {
    return projects.find(p => p.id === projectId) || null;
  };

  // Calculate project statistics
  const getProjectStats = (data: any) => {
    const lemmaCount = Object.keys(data.lemmas || {}).length;
    const tokenCount = Object.keys(data.tokens || {}).length;
    const classifierSet = new Set<string>();
    const lemmasWithClassifiers = new Set<number>();
    let tokensWithClassifiers = 0;
    if (Array.isArray(data.classifiers)) {
      data.classifiers.forEach((entry: any) => {
        const classifier = entry?.gardiner_number || entry?.clf || entry?.classifier || entry?.mdc;
        if (classifier) {
          classifierSet.add(String(classifier));
        }
      });
    }
    if (data.tokens) {
      Object.values(data.tokens).forEach((token: any) => {
        const clfs = extractClassifiersFromString(token.mdc_w_markup);
        if (clfs.length === 0) return;
        tokensWithClassifiers += 1;
        if (typeof token?.lemma_id === "number") {
          lemmasWithClassifiers.add(token.lemma_id);
        }
      });
    }
    const classifierCount = classifierSet.size;
    const witnessCount = Object.keys(data.witnesses || {}).length;
    
    return {
      lemmaCount,
      tokenCount,
      classifierCount,
      witnessCount,
      lemmasWithClassifiers: lemmasWithClassifiers.size,
      tokensWithClassifiers
    };
  };

  // Project Summary Component
  const ProjectSummary = ({ projectId, data }: { projectId: string, data: any }) => {
    const projectInfo = getProjectInfo(projectId);
    const stats = getProjectStats(data);
    
    if (!projectInfo) return null;

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-start gap-4">
            <Button
              variant="outline"
              onClick={() => setSelectedProject(null)}
              className="mt-1"
            >
              ← Back to Projects
            </Button>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{projectInfo.name}</h3>
              <p className="text-gray-600 text-sm uppercase tracking-wide mb-4">
                {projectInfo.type} • {projectInfo.authors}
              </p>
            </div>
          </div>
          <Button 
            onClick={() => handleAnalyzeProject(projectId)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            View Project
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <span className="egyptian-unicode text-3xl text-blue-600 mx-auto mb-2 block">𓆣</span>
            <div className="text-2xl font-bold text-gray-900">
              {stats.lemmasWithClassifiers.toLocaleString()} / {stats.lemmaCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Lemmas</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <span className="egyptian-unicode text-3xl text-green-600 mx-auto mb-2 block">𓆈</span>
            <div className="text-2xl font-bold text-gray-900">
              {stats.tokensWithClassifiers.toLocaleString()} / {stats.tokenCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Tokens</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <span className="egyptian-unicode text-3xl text-purple-600 mx-auto mb-2 block">𓀁</span>
            <div className="text-2xl font-bold text-gray-900">{stats.classifierCount.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Classifiers</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <span className="egyptian-unicode text-3xl text-orange-600 mx-auto mb-2 block">𓇩</span>
            <div className="text-2xl font-bold text-gray-900">{stats.witnessCount.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Witnesses</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
            <p className="text-gray-700 leading-relaxed">{projectInfo.description}</p>
          </div>
          
          <Citation
            type="project"
            projectName={projectInfo.name}
            authors={projectInfo.authors}
            projectId={projectId}
          />

        </div>
      </div>
    );
  };

  // If a project is selected and loading/loaded, show the summary
  if (selectedProject) {
    if (projectLoading) {
      return (
        <SidebarLayout>
          <div className="flex flex-col items-center justify-center py-16">
            <NetworkLoader
              title="Loading Project Data"
              subtitle="Analyzing corpus and preparing statistics..."
            />
          </div>
        </SidebarLayout>
      );
    }

    if (projectError) {
      const projectInfo = getProjectInfo(selectedProject);
      return (
        <SidebarLayout>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Project</h3>
            <p className="text-red-600 mb-4">{projectError}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setSelectedProject(null)}>
                ← Back to Projects
              </Button>
              <Button onClick={() => handleProjectSelect(selectedProject)}>
                Retry Loading
              </Button>
            </div>
          </div>
          {projectInfo && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-semibold mb-2">{projectInfo.name}</h4>
              <p className="text-gray-700 mb-4">{projectInfo.description}</p>
              <Button onClick={() => handleAnalyzeProject(selectedProject)}>
                View Project (Limited Mode)
              </Button>
            </div>
          )}
        </SidebarLayout>
      );
    }

    // Show project summary with loaded data
    if (projectData) {
      return (
        <SidebarLayout>
          <ProjectSummary projectId={selectedProject} data={projectData} />
        </SidebarLayout>
      );
    }
  }

  // Show Egyptian projects sub-collection
  if (showEgyptianProjects) {
    return (
      <SidebarLayout>
        <section className="mb-16">
          <div className="mb-8">
            <Button
              onClick={() => setShowEgyptianProjects(false)}
              variant="outline" 
              className="mb-4"
            >
              ← Back to Script Selection
            </Button>
            <h2 className="text-[28px] sm:text-[34px] font-bold leading-[110%] tracking-[-0.68px] mb-2">
              Ancient Egyptian Projects
            </h2>
            <p className="text-base text-[#454545] leading-[150%]">
              Browse the unified corpus or choose an individual Egyptian project
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-10">
            <div>
              <div className="text-sm font-semibold mb-3">Choose all egyptian texts</div>
              <button
                onClick={() => handleProjectSelect(combinedEgyptianProject.id)}
                className="text-left text-inherit no-underline hover:opacity-90 transition-opacity border-none bg-transparent p-0 cursor-pointer w-full"
              >
                <ProjectCard
                  image={combinedEgyptianProject.image}
                  title={combinedEgyptianProject.name}
                  description={combinedEgyptianProject.description}
                  size="large"
                  imageClassName="object-[50%_20%]"
                />
              </button>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold mb-3">Browse by research project</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {egyptianProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectSelect(project.id)}
                    className="text-left text-inherit no-underline hover:opacity-90 transition-opacity border-none bg-transparent p-0 cursor-pointer"
                  >
                    <ProjectCard
                      image={project.image}
                      title={project.name}
                      description={project.description}
                      size="large"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </SidebarLayout>
    );
  }

  // Main project selection view
  return (
    <SidebarLayout>
      <section className="mb-16">
        <div className="mb-8">
          <h2 className="text-[28px] sm:text-[34px] font-bold leading-[110%] tracking-[-0.68px] mb-2">
            Browse by Language 
          </h2>
          <p className="text-base text-[#454545] leading-[150%]">
            Browse knowledge organization across ancient script traditions
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <button
            onClick={() => setShowEgyptianProjects(true)}
            className="text-left text-inherit no-underline hover:opacity-90 transition-opacity border-none bg-transparent p-0 cursor-pointer"
          >
            <ProjectCard
              image={combinedEgyptianProject.image}
              title="Ancient Egyptian Scripts"
              description="A Classifier Corpus-based Dictionary of Ancient Egyptian Texts"
              size="large"
            />
          </button>
          {nonEgyptianProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectSelect(project.id)}
              className="text-left text-inherit no-underline hover:opacity-90 transition-opacity border-none bg-transparent p-0 cursor-pointer"
            >
              <ProjectCard
                image={project.image}
                title={project.name}
                description={project.description}
                size="large"
              />
            </button>
          ))}
        </div>
      </section>
    </SidebarLayout>
  );
}
