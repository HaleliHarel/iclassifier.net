import { useNavigate } from "react-router-dom";
import { useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import ProjectCard from "@/components/ProjectCard";
import { combinedEgyptianProject, egyptianProjects, nonEgyptianProjects, Project, projects } from "@/lib/sampleData";
import { Button } from "@/components/ui/button";
import { useProject } from "@/lib/projectContext";

export default function Index() {
  const [showEgyptianProjects, setShowEgyptianProjects] = useState(false);
  const { setCurrentProject } = useProject();
  const navigate = useNavigate();

  const handleProjectNavigate = (projectId: string) => {
    setCurrentProject(projectId);
    navigate(`/project/${projectId}`);
  };

  const getProjectInfo = (projectId: string): Project | null => {
    return projects.find((project) => project.id === projectId) || null;
  };

  // Show Egyptian projects sub-collection
  if (showEgyptianProjects) {
    return (
      <SidebarLayout>
        <section className="mb-16">
          <div className="mb-6">
            <Button
              onClick={() => setShowEgyptianProjects(false)}
              variant="outline"
              className="mb-3"
            >
              ← Back to Script Selection
            </Button>
            <h2 className="text-[28px] sm:text-[34px] font-bold leading-[110%] tracking-[-0.68px] mb-2">
              Ancient Egyptian Projects
            </h2>
            <p className="text-base text-gray-700 leading-[150%]">
              Browse the unified corpus or choose an individual Egyptian project
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-10">
            <div>
              <div className="text-sm font-semibold mb-3">Choose all egyptian texts</div>
              <button
                onClick={() => handleProjectNavigate(combinedEgyptianProject.id)}
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
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="text-sm font-semibold mb-3">Browse by research project</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {egyptianProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleProjectNavigate(project.id)}
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

  return (
    <SidebarLayout>
      <section className="mb-16">
        <div className="mb-6">
          <h2 className="text-[28px] sm:text-[34px] font-bold leading-[110%] tracking-[-0.68px] mb-2">
            Browse by Language
          </h2>
          <p className="text-base text-gray-700 leading-[150%]">
            Browse knowledge organization across ancient script traditions
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              onClick={() => handleProjectNavigate(project.id)}
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
