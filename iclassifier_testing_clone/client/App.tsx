import "./global.css";

// Initialize Builder.io custom components (must be imported before components)
import "./builder-registry";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import { ProjectProvider, useProject } from "@/lib/projectContext";
import { ProjectDataProvider } from "@/lib/dataProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eager load: Home and main pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Project loading component
const ProjectLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-4"></div>
      <p className="text-gray-600">Loading project context...</p>
    </div>
  </div>
);

// Wrapper component to handle project loading state
const ProjectAwareRoutes = () => {
  const { isLoading } = useProject();
  
  if (isLoading) {
    return <ProjectLoader />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<Index />} />
      <Route path="/reports" element={<Index />} />
      <Route path="/project" element={<Navigate to="/projects" replace />} />
      <Route path="/project/:projectId" element={<ProjectLanding />} />
      <Route path="/project/:projectId/lemma" element={<LemmaReport />} />
      <Route path="/project/:projectId/lemma/:lemmaId" element={<LemmaReport />} />
      <Route path="/project/:projectId/classifier" element={<ClassifierReport />} />
      <Route path="/project/:projectId/classifier/:classifierId" element={<ClassifierReport />} />
      <Route path="/project/:projectId/query-report" element={<QueryReport />} />
      <Route path="/project/:projectId/map-report" element={<NetworkMapReport />} />
      <Route path="/bug-report" element={<BugReport />} />
      <Route path="/contact-us" element={<ContactUs />} />
      <Route path="/user-manual" element={<UserManual />} />
      <Route path="/debug-projects" element={<DebugProjects />} />
      {/* Legacy routes for backward compatibility */}
      <Route path="/lemma" element={<LemmaReport />} />
      <Route path="/classifier" element={<ClassifierReport />} />
      <Route path="/query-report" element={<QueryReport />} />
      <Route path="/map-report" element={<NetworkMapReport />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Lazy load: Report pages (code-split for better initial load)
const ProjectLanding = lazy(() => import("./pages/ProjectLanding"));
const LemmaReport = lazy(() => import("./pages/LemmaReport"));
const ClassifierReport = lazy(() => import("./pages/ClassifierReport"));
const QueryReport = lazy(() => import("./pages/QueryReport"));
const NetworkMapReport = lazy(() => import("./pages/NetworkMapReport"));
const BugReport = lazy(() => import("./pages/BugReport"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const UserManual = lazy(() => import("./pages/UserManual"));
const DebugProjects = lazy(() => import("./pages/DebugProjects"));
const TestPage = lazy(() => import("./pages/TestPage"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-4"></div>
      <p className="text-gray-600">Loading page...</p>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ProjectDataProvider>
          <ProjectProvider>
            <AppHeader />
            <Suspense fallback={<PageLoader />}>
              <ProjectAwareRoutes />
            </Suspense>
          </ProjectProvider>
        </ProjectDataProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(<App />);
