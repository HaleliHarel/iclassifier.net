import "./global.css";

// Initialize Builder.io custom components (must be imported before components)
import "./builder-registry";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import { ProjectProvider, useProject } from "@/lib/projectContext";
import { ProjectDataProvider } from "@/lib/dataProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import { ComparisonProvider } from "@/context/ComparisonContext";
import { APP_BASE_PATH } from "@/lib/apiBase";

// Eager load: Home and main pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProjectLanding from "./pages/ProjectLanding";
import LemmaReport from "./pages/LemmaReport";
import ClassifierReport from "./pages/ClassifierReport";
import QueryReport from "./pages/QueryReport";
import NetworkMapReport from "./pages/NetworkMapReport";
import BugReport from "./pages/BugReport";
import ContactUs from "./pages/ContactUs";
import UserManual from "./pages/UserManual";
import About from "./pages/About";
import DebugProjects from "./pages/DebugProjects";
import TestPage from "./pages/TestPage";
import ComparisonPage from "./pages/ComparisonPage";
import CompareLanding from "./pages/CompareLanding";
import BackSoon from "./pages/BackSoon";

const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === "true";
const ROUTER_BASENAME = APP_BASE_PATH === "/" ? undefined : APP_BASE_PATH;

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

  if (MAINTENANCE_MODE) {
    return (
      <Routes>
        <Route path="*" element={<BackSoon />} />
      </Routes>
    );
  }

  if (isLoading) {
    return <ProjectLoader />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/reports" replace />} />
      <Route path="/reports" element={<Index />} />
      <Route path="/compare" element={<CompareLanding />} />
      <Route path="/compare/:leftProject/:rightProject" element={<ComparisonPage />} />
      <Route path="/project" element={<Navigate to="/reports" replace />} />
      <Route path="/project/:projectId" element={<ProjectLanding />} />
      <Route path="/project/:projectId/lemma" element={<LemmaReport />} />
      <Route path="/project/:projectId/lemma/:lemmaId" element={<LemmaReport />} />
      <Route path="/project/:projectId/classifier" element={<ClassifierReport />} />
      <Route path="/project/:projectId/classifier/:classifierId" element={<ClassifierReport />} />
      <Route path="/project/:projectId/query-report" element={<QueryReport />} />
      <Route path="/project/:projectId/network" element={<NetworkMapReport />} />
      <Route path="/bug-report" element={<BugReport />} />
      <Route path="/contact-us" element={<ContactUs />} />
      <Route path="/about" element={<About />} />
      <Route path="/user-manual" element={<UserManual />} />
      <Route path="/debug-projects" element={<DebugProjects />} />
      {/* Legacy routes for backward compatibility */}
      <Route path="/lemma" element={<LemmaReport />} />
      <Route path="/classifier" element={<ClassifierReport />} />
      <Route path="/query-report" element={<QueryReport />} />
      <Route path="/network" element={<NetworkMapReport />} />
      <Route path="/backsoon" element={<BackSoon />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

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
        basename={ROUTER_BASENAME}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScrollToTop />
        <ComparisonProvider>
          <ProjectDataProvider>
            <ProjectProvider>
              <AppHeader />
              <Suspense fallback={<PageLoader />}>
                <ProjectAwareRoutes />
              </Suspense>
            </ProjectProvider>
          </ProjectDataProvider>
        </ComparisonProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(<App />);
