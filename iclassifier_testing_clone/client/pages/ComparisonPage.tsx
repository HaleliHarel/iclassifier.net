import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { X } from "lucide-react";
import TopNavButtons from "@/components/TopNavButtons";
import GlobalFooter from "@/components/GlobalFooter";
import { ProjectContextOverrideProvider } from "@/context/ProjectContextOverride";
import { useProjectData } from "@/lib/dataProvider";
import { extractClassifiersFromString } from "@/lib/networkUtils";
import { projects } from "@/lib/sampleData";
import { mdc2uni } from "@/lib/mdc2uni";
import { fetchJseshBase64, getJseshImageUrl, getJseshRenderHeight } from "@/lib/jsesh";
import { formatClassifierMeaning } from "@/lib/classifierMeaningFormat";

// Import all report components
import ClassifierReport from "./ClassifierReport";
import LemmaReport from "./LemmaReport";
import QueryReport from "./QueryReport";
import NetworkMapReport from "./NetworkMapReport";
import ProjectLanding from "./ProjectLanding";

type ReportType = "classifier" | "lemma" | "query" | "network" | "project";

const VALID_REPORT_TYPES: ReportType[] = ["classifier", "lemma", "query", "network", "project"];

interface ProjectSummary {
  lemmaCount: number;
  tokenCount: number;
  classifierCount: number;
  witnessCount: number;
  classifierSet: Set<string>;
  classifierCounts: Record<string, number>;
}

const isValidClassifierKey = (value: unknown) => {
  const key = String(value ?? "").trim();
  if (!key) return false;
  if (/^\/+$/.test(key)) return false;
  return true;
};

const buildProjectSummary = (projectData: any): ProjectSummary => {
  const lemmas = projectData?.lemmas || {};
  const tokens = projectData?.tokens || {};
  const witnesses = projectData?.witnesses || {};
  const classifiersMeta = Array.isArray(projectData?.classifiers) ? projectData.classifiers : [];

  const classifierSet = new Set<string>();
  const classifierCounts: Record<string, number> = {};

  if (classifiersMeta.length > 0) {
    classifiersMeta.forEach((entry: any) => {
      const classifier = entry?.clf || entry?.gardiner_number || entry?.classifier || entry?.mdc;
      if (!isValidClassifierKey(classifier)) return;
      const key = String(classifier);
      classifierSet.add(key);
      classifierCounts[key] = (classifierCounts[key] || 0) + 1;
    });
  } else {
    Object.values(tokens).forEach((token: any) => {
      const clfs = extractClassifiersFromString(token?.mdc_w_markup || "");
      if (clfs.length === 0) return;
      clfs.forEach((clf) => {
        if (!isValidClassifierKey(clf)) return;
        classifierSet.add(clf);
        classifierCounts[clf] = (classifierCounts[clf] || 0) + 1;
      });
    });
  }

  return {
    lemmaCount: Object.keys(lemmas).length,
    tokenCount: Object.keys(tokens).length,
    classifierCount: classifierSet.size,
    witnessCount: Object.keys(witnesses).length,
    classifierSet,
    classifierCounts,
  };
};

const normalizeLemmaKey = (lemma: { transliteration?: string | null; meaning?: string | null; id?: number }) => {
  const translit = String(lemma.transliteration || "").trim();
  if (translit) return translit.toLowerCase();
  const meaning = String(lemma.meaning || "").trim();
  if (meaning) return meaning.toLowerCase();
  return String(lemma.id ?? "").trim().toLowerCase();
};

const extractConcepts = (concept?: string | null) => {
  if (!concept) return [];
  return String(concept)
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseReportType = (value: string | null): ReportType => {
  if (value && VALID_REPORT_TYPES.includes(value as ReportType)) {
    return value as ReportType;
  }
  return "project";
};

const getReportPath = (projectId: string, reportType: ReportType) => {
  switch (reportType) {
    case "classifier":
      return `/project/${projectId}/classifier`;
    case "lemma":
      return `/project/${projectId}/lemma`;
    case "query":
      return `/project/${projectId}/query-report`;
    case "network":
      return `/project/${projectId}/network`;
    case "project":
    default:
      return `/project/${projectId}`;
  }
};

interface PanelProps {
  projectId: string;
  reportType: ReportType;
  title: string;
  onClose: () => void;
}

function PanelContent({ projectId, reportType }: Omit<PanelProps, "title" | "onClose">) {
  switch (reportType) {
    case "classifier":
      return <ClassifierReport />;
    case "lemma":
      return <LemmaReport />;
    case "query":
      return <QueryReport />;
    case "network":
      return <NetworkMapReport />;
    case "project":
      return <ProjectLanding />;
    default:
      return <div>Unknown report type</div>;
  }
}

interface ComparisonPanelProps extends PanelProps {
  panelPosition: "left" | "right";
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

const ComparisonPanel = memo(function ComparisonPanel({
  projectId,
  reportType,
  title,
  onClose,
  panelPosition,
  onScroll,
}: ComparisonPanelProps) {
  return (
    <ProjectContextOverrideProvider overrideProjectId={projectId} panelPosition={panelPosition}>
      <div className="compare-panel h-full flex flex-col bg-white min-w-0 min-h-0">
        {/* Top header with close button */}
        {/* Project header removed per compare layout */}

        {/* Content */}
        <div
          className="flex-1 min-h-0 overflow-auto px-2 sm:px-3 lg:px-3 py-2 min-w-0"
          onScroll={onScroll}
        >
          <PanelContent projectId={projectId} reportType={reportType} />
        </div>
      </div>
    </ProjectContextOverrideProvider>
  );
});

export default function ComparisonPage() {
  const { leftProject, rightProject } = useParams<{ leftProject: string; rightProject: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [panelSizes, setPanelSizes] = useState<[number, number]>([50, 50]);
  const panelSizesRef = useRef<[number, number]>([50, 50]);
  const panelRafRef = useRef<number | null>(null);
  const headerSplitRef = useRef<HTMLDivElement>(null);
  const [isHeaderDragging, setIsHeaderDragging] = useState(false);
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  const schedulePanelSizes = useCallback((sizes: [number, number]) => {
    panelSizesRef.current = sizes;
    if (panelRafRef.current !== null) return;
    panelRafRef.current = window.requestAnimationFrame(() => {
      panelRafRef.current = null;
      setPanelSizes(panelSizesRef.current);
    });
  }, []);

  const handlePanelLayout = useCallback((sizes: number[]) => {
    if (!sizes || sizes.length < 2) return;
    schedulePanelSizes([sizes[0], sizes[1]]);
  }, [schedulePanelSizes]);

  const handleHeaderDragStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsHeaderDragging(true);
  }, []);

  const handlePanelScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const nextTop = event.currentTarget.scrollTop;
    const lastTop = lastScrollTopRef.current;
    const delta = nextTop - lastTop;
    if (tabsCollapsed) {
      lastScrollTopRef.current = nextTop;
      return;
    }
    if (nextTop <= 20) {
      setHeaderHidden(false);
    } else if (delta > 12) {
      setHeaderHidden(true);
    } else if (delta < -12) {
      setHeaderHidden(false);
    }
    lastScrollTopRef.current = nextTop;
  }, [tabsCollapsed]);

  useEffect(() => {
    const handleToggleTabs = (event: Event) => {
      const detail = (event as CustomEvent<{ collapsed?: boolean }>).detail;
      const next = typeof detail?.collapsed === "boolean" ? detail.collapsed : !tabsCollapsed;
      setTabsCollapsed(next);
      if (!next) setHeaderHidden(false);
    };
    const handleJumpSummary = () => {
      setTabsCollapsed(true);
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("compare:toggle-tabs", handleToggleTabs as EventListener);
    window.addEventListener("compare:jump-summary", handleJumpSummary as EventListener);
    return () => {
      window.removeEventListener("compare:toggle-tabs", handleToggleTabs as EventListener);
      window.removeEventListener("compare:jump-summary", handleJumpSummary as EventListener);
    };
  }, [tabsCollapsed]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("compare:tabs-state", { detail: { collapsed: tabsCollapsed } })
    );
  }, [tabsCollapsed]);

  useEffect(() => {
    if (!isHeaderDragging) return;
    const handleMove = (event: MouseEvent) => {
      if (!headerSplitRef.current) return;
      const rect = headerSplitRef.current.getBoundingClientRect();
      if (!rect.width) return;
      const nextPercent = ((event.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(20, Math.min(80, nextPercent));
      schedulePanelSizes([clamped, 100 - clamped]);
    };
    const handleUp = () => setIsHeaderDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isHeaderDragging, schedulePanelSizes]);

  useEffect(() => {
    return () => {
      if (panelRafRef.current !== null) {
        window.cancelAnimationFrame(panelRafRef.current);
      }
    };
  }, []);

  const leftProjectId = leftProject;
  const rightProjectId = rightProject;

  const {
    lemmas: leftLemmas,
    tokens: leftTokens,
    witnesses: leftWitnesses,
    classifiers: leftClassifiers,
    classifierMeanings: leftClassifierMeanings
  } = useProjectData(leftProjectId || "");
  const {
    lemmas: rightLemmas,
    tokens: rightTokens,
    witnesses: rightWitnesses,
    classifiers: rightClassifiers,
    classifierMeanings: rightClassifierMeanings
  } = useProjectData(rightProjectId || "");

  const leftProjectInfo = useMemo(
    () => projects.find((project) => project.id === leftProjectId),
    [leftProjectId]
  );
  const rightProjectInfo = useMemo(
    () => projects.find((project) => project.id === rightProjectId),
    [rightProjectId]
  );
  const leftProjectName = leftProjectInfo?.name || leftProjectId;
  const rightProjectName = rightProjectInfo?.name || rightProjectId;

  const leftSummary = useMemo(
    () => buildProjectSummary({
      lemmas: leftLemmas,
      tokens: leftTokens,
      witnesses: leftWitnesses,
      classifiers: leftClassifiers
    }),
    [leftLemmas, leftTokens, leftWitnesses, leftClassifiers]
  );
  const rightSummary = useMemo(
    () => buildProjectSummary({
      lemmas: rightLemmas,
      tokens: rightTokens,
      witnesses: rightWitnesses,
      classifiers: rightClassifiers
    }),
    [rightLemmas, rightTokens, rightWitnesses, rightClassifiers]
  );

  const sharedClassifiers = useMemo(() => {
    const shared: string[] = [];
    leftSummary.classifierSet.forEach((clf) => {
      if (rightSummary.classifierSet.has(clf)) {
        shared.push(clf);
      }
    });
    return shared.sort();
  }, [leftSummary.classifierSet, rightSummary.classifierSet]);

  const uniqueLeftClassifiers = useMemo(() => {
    const unique: string[] = [];
    leftSummary.classifierSet.forEach((clf) => {
      if (!rightSummary.classifierSet.has(clf)) {
        unique.push(clf);
      }
    });
    return unique.sort();
  }, [leftSummary.classifierSet, rightSummary.classifierSet]);

  const uniqueRightClassifiers = useMemo(() => {
    const unique: string[] = [];
    rightSummary.classifierSet.forEach((clf) => {
      if (!leftSummary.classifierSet.has(clf)) {
        unique.push(clf);
      }
    });
    return unique.sort();
  }, [leftSummary.classifierSet, rightSummary.classifierSet]);

  const { sharedLemmas, uniqueLeftLemmas, uniqueRightLemmas } = useMemo(() => {
    const leftMap = new Map<string, { label: string; id: number }>();
    const rightMap = new Map<string, { label: string; id: number }>();
    Object.values(leftLemmas || {}).forEach((lemma: any) => {
      const key = normalizeLemmaKey(lemma);
      if (!key) return;
      const label = lemma.transliteration || lemma.meaning || String(lemma.id);
      if (!leftMap.has(key)) {
        leftMap.set(key, { label, id: Number(lemma.id) });
      }
    });
    Object.values(rightLemmas || {}).forEach((lemma: any) => {
      const key = normalizeLemmaKey(lemma);
      if (!key) return;
      const label = lemma.transliteration || lemma.meaning || String(lemma.id);
      if (!rightMap.has(key)) {
        rightMap.set(key, { label, id: Number(lemma.id) });
      }
    });

    const shared: string[] = [];
    const uniqueLeft: string[] = [];
    const uniqueRight: string[] = [];

    leftMap.forEach((_, key) => {
      if (rightMap.has(key)) {
        shared.push(key);
      } else {
        uniqueLeft.push(key);
      }
    });
    rightMap.forEach((_, key) => {
      if (!leftMap.has(key)) {
        uniqueRight.push(key);
      }
    });

    const labelFor = (key: string, map: Map<string, { label: string; id: number }>) => map.get(key)?.label || key;
    const leftIdFor = (key: string) => leftMap.get(key)?.id;
    const rightIdFor = (key: string) => rightMap.get(key)?.id;

    return {
      sharedLemmas: shared.sort().map((key) => ({
        key,
        label: labelFor(key, leftMap) || labelFor(key, rightMap),
        leftId: leftIdFor(key),
        rightId: rightIdFor(key)
      })),
      uniqueLeftLemmas: uniqueLeft.sort().map((key) => ({
        key,
        label: labelFor(key, leftMap),
        leftId: leftIdFor(key)
      })),
      uniqueRightLemmas: uniqueRight.sort().map((key) => ({
        key,
        label: labelFor(key, rightMap),
        rightId: rightIdFor(key)
      }))
    };
  }, [leftLemmas, rightLemmas]);

  const sharedConcepts = useMemo(() => {
    const leftConceptSet = new Set<string>();
    const rightConceptSet = new Set<string>();
    Object.values(leftLemmas || {}).forEach((lemma: any) => {
      extractConcepts(lemma?.concept).forEach((concept) => {
        leftConceptSet.add(concept.toLowerCase());
      });
    });
    Object.values(rightLemmas || {}).forEach((lemma: any) => {
      extractConcepts(lemma?.concept).forEach((concept) => {
        rightConceptSet.add(concept.toLowerCase());
      });
    });
    const shared: string[] = [];
    leftConceptSet.forEach((concept) => {
      if (rightConceptSet.has(concept)) {
        shared.push(concept);
      }
    });
    return shared.sort();
  }, [leftLemmas, rightLemmas]);

  const [jseshGlyphs, setJseshGlyphs] = useState<Record<string, string>>({});
  useEffect(() => {
    const needsJsesh: string[] = [];
    const leftIsEgyptian = leftProjectInfo?.type === "hieroglyphic";
    const rightIsEgyptian = rightProjectInfo?.type === "hieroglyphic";
    const sharedDisplay = sharedClassifiers.slice(0, 80);
    const leftDisplay = uniqueLeftClassifiers.slice(0, 40);
    const rightDisplay = uniqueRightClassifiers.slice(0, 40);

    sharedDisplay.forEach((clf) => {
      if ((leftIsEgyptian || rightIsEgyptian) && !mdc2uni[clf] && !jseshGlyphs[clf]) {
        needsJsesh.push(clf);
      }
    });
    if (leftIsEgyptian) {
      leftDisplay.forEach((clf) => {
        if (!mdc2uni[clf] && !jseshGlyphs[clf]) {
          needsJsesh.push(clf);
        }
      });
    }
    if (rightIsEgyptian) {
      rightDisplay.forEach((clf) => {
        if (!mdc2uni[clf] && !jseshGlyphs[clf]) {
          needsJsesh.push(clf);
        }
      });
    }

    if (needsJsesh.length === 0) return;
    let cancelled = false;
    const fetchAll = async () => {
      const updates: Record<string, string> = {};
      await Promise.all(needsJsesh.map(async (clf) => {
        const base64 = await fetchJseshBase64(clf, getJseshRenderHeight(28), true);
        if (base64) {
          updates[clf] = getJseshImageUrl(base64);
        }
      }));
      if (!cancelled && Object.keys(updates).length > 0) {
        setJseshGlyphs((prev) => ({ ...prev, ...updates }));
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [
    sharedClassifiers,
    uniqueLeftClassifiers,
    uniqueRightClassifiers,
    leftProjectInfo?.type,
    rightProjectInfo?.type,
    jseshGlyphs
  ]);

  // Get report types from search params or default to project
  const leftReportType = parseReportType(searchParams.get("leftType"));
  const rightReportType = parseReportType(searchParams.get("rightType"));

  // If missing required params, redirect back
  useEffect(() => {
    if (!leftProjectId || !rightProjectId) {
      navigate("/compare", { replace: true });
    }
  }, [leftProjectId, rightProjectId, navigate]);

  const handleCloseLeft = useCallback(() => {
    if (rightProjectId) {
      navigate(getReportPath(rightProjectId, rightReportType), { replace: true });
    } else {
      navigate("/reports", { replace: true });
    }
  }, [navigate, rightProjectId, rightReportType]);

  const handleCloseRight = useCallback(() => {
    if (leftProjectId) {
      navigate(getReportPath(leftProjectId, leftReportType), { replace: true });
    } else {
      navigate("/reports", { replace: true });
    }
  }, [navigate, leftProjectId, leftReportType]);

  const handleLeftReportTypeChange = useCallback((reportType: string) => {
    // Ensure the report type is valid before updating
    if (VALID_REPORT_TYPES.includes(reportType as ReportType)) {
      const params = new URLSearchParams(searchParams);
      params.set("leftType", reportType);
      setSearchParams(params);
    }
  }, [searchParams, setSearchParams]);

  const handleRightReportTypeChange = useCallback((reportType: string) => {
    // Ensure the report type is valid before updating
    if (VALID_REPORT_TYPES.includes(reportType as ReportType)) {
      const params = new URLSearchParams(searchParams);
      params.set("rightType", reportType);
      setSearchParams(params);
    }
  }, [searchParams, setSearchParams]);

  const updateClassifierTarget = useCallback(
    (classifier: string, target: "left" | "right" | "both") => {
      setTabsCollapsed(false);
      const params = new URLSearchParams(searchParams);
      if (target === "left" || target === "both") {
        params.set("leftType", "classifier");
        params.set("leftClassifier", classifier);
        params.delete("leftLemmaId");
      }
      if (target === "right" || target === "both") {
        params.set("rightType", "classifier");
        params.set("rightClassifier", classifier);
        params.delete("rightLemmaId");
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams, setTabsCollapsed]
  );

  const updateLemmaTarget = useCallback(
    (lemma: { leftId?: number; rightId?: number }, target: "left" | "right" | "both") => {
      setTabsCollapsed(false);
      const params = new URLSearchParams(searchParams);
      const applyTo = (side: "left" | "right", lemmaId?: number) => {
        params.set(`${side}Type`, "lemma");
        if (lemmaId !== null && lemmaId !== undefined && Number.isFinite(lemmaId)) {
          params.set(`${side}LemmaId`, String(lemmaId));
        } else {
          params.delete(`${side}LemmaId`);
        }
        params.delete(`${side}Classifier`);
      };
      if (target === "left" || target === "both") {
        applyTo("left", lemma.leftId);
      }
      if (target === "right" || target === "both") {
        applyTo("right", lemma.rightId);
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams, setTabsCollapsed]
  );

  const getClassifierMeaningLabel = useCallback(
    (classifier: string) => {
      const leftMeaning = leftClassifierMeanings?.[classifier];
      const rightMeaning = rightClassifierMeanings?.[classifier];
      if (leftMeaning) {
        return formatClassifierMeaning(leftMeaning, leftProjectId).toLowerCase();
      }
      if (rightMeaning) {
        return formatClassifierMeaning(rightMeaning, rightProjectId).toLowerCase();
      }
      return "";
    },
    [leftClassifierMeanings, rightClassifierMeanings, leftProjectId, rightProjectId]
  );

  const renderClassifierBadge = (
    classifier: string,
    target: "left" | "right" | "both",
    showEgyptianGlyph: boolean
  ) => {
    const meaningLabel = getClassifierMeaningLabel(classifier);
    const unicodeGlyph = showEgyptianGlyph ? mdc2uni[classifier] : null;
    const jseshUrl = showEgyptianGlyph && !unicodeGlyph ? jseshGlyphs[classifier] : null;
    const badgeClasses = target === "left"
      ? "border-teal-200 bg-teal-50 text-teal-900 hover:border-teal-300 hover:bg-teal-100"
      : target === "right"
        ? "border-orange-200 bg-orange-50 text-orange-900 hover:border-orange-300 hover:bg-orange-100"
        : "border-[#f6d47a] bg-[#fff5c2] text-gray-800 hover:border-yellow-400 hover:bg-yellow-100";
    return (
      <button
        key={`${classifier}-${target}`}
        type="button"
        onClick={() => updateClassifierTarget(classifier, target)}
        className={`rounded-md border px-2 py-1 text-left text-xs shadow-sm transition-colors ${badgeClasses}`}
      >
        <div className="flex items-center gap-2">
          {showEgyptianGlyph && (
            unicodeGlyph ? (
              <span className="egyptian-unicode text-lg leading-none">{unicodeGlyph}</span>
            ) : jseshUrl ? (
              <img src={jseshUrl} alt={classifier} className="h-5 w-auto" />
            ) : (
              <span className="text-[11px] text-gray-500">?</span>
            )
          )}
          <span className="font-semibold">{showEgyptianGlyph ? `(${classifier})` : classifier}</span>
        </div>
        {meaningLabel && (
          <div className="text-[10px] text-gray-600" style={{ fontVariant: "small-caps" }}>
            [{meaningLabel}]
          </div>
        )}
      </button>
    );
  };

  if (!leftProjectId || !rightProjectId) {
    return null;
  }

  return (
    <div
      className="flex flex-col bg-white min-h-0 overflow-hidden"
      style={{ height: "calc(100vh - var(--app-header-height, 0px))" }}
    >
      <div className="bg-white">
        {!tabsCollapsed && !headerHidden && (
          <div ref={headerSplitRef} className="flex w-full items-stretch pb-2">
            <div
              className="min-w-0 px-2 sm:px-3"
              style={{ flex: `0 0 ${panelSizes[0]}%` }}
            >
              <div className="rounded-md border border-teal-200 bg-teal-50 p-2 h-full">
                <div className="text-sm font-semibold text-teal-900 mb-2">{leftProjectName}</div>
                <TopNavButtons
                  projectId={leftProjectId}
                  panelPosition="left"
                  onReportTypeChange={handleLeftReportTypeChange}
                  currentReportType={leftReportType}
                  compact
                />
              </div>
            </div>

            <div
              onMouseDown={handleHeaderDragStart}
              className="relative flex w-2 cursor-col-resize items-center justify-center"
              title="Drag to resize panels"
            >
              <div className="h-full w-px bg-gray-300" />
              <div className="absolute flex h-6 w-3 items-center justify-center rounded-sm border border-gray-300 bg-white">
                <div className="h-3 w-0.5 bg-gray-400" />
              </div>
            </div>

            <div
              className="min-w-0 px-2 sm:px-3"
              style={{ flex: `0 0 ${panelSizes[1]}%` }}
            >
              <div className="rounded-md border border-orange-200 bg-orange-50 p-2 h-full">
                <div className="text-sm font-semibold text-orange-900 mb-2">{rightProjectName}</div>
                <TopNavButtons
                  projectId={rightProjectId}
                  panelPosition="right"
                  onReportTypeChange={handleRightReportTypeChange}
                  currentReportType={rightReportType}
                  compact
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
          {!tabsCollapsed && (
            <ResizablePanel defaultSize={70} minSize={30} className="min-h-0">
              <ResizablePanelGroup
                direction="horizontal"
                className="h-full min-h-0"
                onLayout={handlePanelLayout}
              >
                {/* Left Panel */}
                <ResizablePanel className="min-w-0 min-h-0" minSize={20} maxSize={80} size={panelSizes[0]}>
                  <ComparisonPanel
                    projectId={leftProjectId}
                    reportType={leftReportType}
                    title={`Project: ${leftProjectId}`}
                    onClose={handleCloseLeft}
                    panelPosition="left"
                    onScroll={handlePanelScroll}
                  />
                </ResizablePanel>

                {/* Divider */}
                <ResizableHandle withHandle />

                {/* Right Panel */}
                <ResizablePanel className="min-w-0 min-h-0" minSize={20} maxSize={80} size={panelSizes[1]}>
                  <ComparisonPanel
                    projectId={rightProjectId}
                    reportType={rightReportType}
                    title={`Project: ${rightProjectId}`}
                    onClose={handleCloseRight}
                    panelPosition="right"
                    onScroll={handlePanelScroll}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          )}

          {!tabsCollapsed && <ResizableHandle withHandle />}

          <ResizablePanel
            defaultSize={30}
            minSize={tabsCollapsed ? 100 : 20}
            className="min-h-0"
            size={tabsCollapsed ? 100 : undefined}
          >
            <div
              ref={summaryRef}
              id="comparison-summary"
              className="h-full overflow-auto border-t border-gray-200 bg-white"
              onScroll={handlePanelScroll}
            >
              <div className="mx-auto w-full max-w-[1400px] px-3 py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-gray-900">Comparison Summary</h3>
                  <div className="text-xs text-gray-500">
                    Shared classifiers: {sharedClassifiers.length} • Unique {leftProjectName}: {uniqueLeftClassifiers.length} • Unique {rightProjectName}: {uniqueRightClassifiers.length}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="rounded-md border border-teal-200 bg-teal-50 p-2">
                    <div className="text-sm font-semibold text-teal-900 mb-2">{leftProjectName}</div>
                    <div className="space-y-1 text-sm text-gray-700">
                      <div>Lemmas: {leftSummary.lemmaCount.toLocaleString()}</div>
                      <div>Tokens: {leftSummary.tokenCount.toLocaleString()}</div>
                      <div>Classifiers: {leftSummary.classifierCount.toLocaleString()}</div>
                      <div>Texts: {leftSummary.witnessCount.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="rounded-md border border-orange-200 bg-orange-50 p-2">
                    <div className="text-sm font-semibold text-orange-900 mb-2">{rightProjectName}</div>
                    <div className="space-y-1 text-sm text-gray-700">
                      <div>Lemmas: {rightSummary.lemmaCount.toLocaleString()}</div>
                      <div>Tokens: {rightSummary.tokenCount.toLocaleString()}</div>
                      <div>Classifiers: {rightSummary.classifierCount.toLocaleString()}</div>
                      <div>Texts: {rightSummary.witnessCount.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Shared vs unique</div>
                    <div className="space-y-1 text-sm text-gray-700">
                      <div>Shared classifiers: {sharedClassifiers.length.toLocaleString()}</div>
                      <div>Unique {leftProjectName} classifiers: {uniqueLeftClassifiers.length.toLocaleString()}</div>
                      <div>Unique {rightProjectName} classifiers: {uniqueRightClassifiers.length.toLocaleString()}</div>
                      <div>Shared lemmas: {sharedLemmas.length.toLocaleString()}</div>
                      <div>Unique {leftProjectName} lemmas: {uniqueLeftLemmas.length.toLocaleString()}</div>
                      <div>Unique {rightProjectName} lemmas: {uniqueRightLemmas.length.toLocaleString()}</div>
                      <div>Shared typological meanings: {sharedConcepts.length.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">
                    Shared classifiers ({sharedClassifiers.length})
                  </div>
                  {sharedClassifiers.length === 0 ? (
                    <div className="text-sm text-gray-500">No shared classifiers found.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sharedClassifiers.slice(0, 80).map((clf) => (
                        <div key={clf} className="flex flex-col gap-1">
                          {renderClassifierBadge(
                            clf,
                            "both",
                            (leftProjectInfo?.type === "hieroglyphic") || (rightProjectInfo?.type === "hieroglyphic")
                          )}
                          <div className="text-[10px] text-gray-500">
                            {leftProjectName}:{leftSummary.classifierCounts[clf] || 0} • {rightProjectName}:{rightSummary.classifierCounts[clf] || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {sharedClassifiers.length > 80 && (
                    <div className="text-xs text-gray-500">
                      Showing first 80 shared classifiers.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="rounded-md border border-teal-200 bg-teal-50/60 p-2">
                    <div className="text-sm font-semibold text-gray-800 mb-2">
                      Unique to {leftProjectName} ({uniqueLeftClassifiers.length})
                    </div>
                    {uniqueLeftClassifiers.length === 0 ? (
                      <div className="text-sm text-gray-500">None</div>
                    ) : (
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        {uniqueLeftClassifiers.slice(0, 40).map((clf) => (
                          <div key={clf}>
                            {renderClassifierBadge(
                              clf,
                              "left",
                              leftProjectInfo?.type === "hieroglyphic"
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border border-orange-200 bg-orange-50/60 p-2">
                    <div className="text-sm font-semibold text-gray-800 mb-2">
                      Unique to {rightProjectName} ({uniqueRightClassifiers.length})
                    </div>
                    {uniqueRightClassifiers.length === 0 ? (
                      <div className="text-sm text-gray-500">None</div>
                    ) : (
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        {uniqueRightClassifiers.slice(0, 40).map((clf) => (
                          <div key={clf}>
                            {renderClassifierBadge(
                              clf,
                              "right",
                              rightProjectInfo?.type === "hieroglyphic"
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">
                    Shared lemmas ({sharedLemmas.length})
                  </div>
                  {sharedLemmas.length === 0 ? (
                    <div className="text-sm text-gray-500">No shared lemmas found.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                      {sharedLemmas.slice(0, 50).map((lemma) => (
                        <button
                          key={lemma.key}
                          type="button"
                          onClick={() => updateLemmaTarget(lemma, "both")}
                          className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-left hover:border-gray-400 hover:bg-gray-100"
                          title="Open this lemma in both panels"
                        >
                          {lemma.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3">
                    <div className="text-sm font-semibold text-gray-800 mb-2">
                      Unique lemmas ({leftProjectName}) ({uniqueLeftLemmas.length})
                    </div>
                    {uniqueLeftLemmas.length === 0 ? (
                      <div className="text-sm text-gray-500">None</div>
                    ) : (
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        {uniqueLeftLemmas.slice(0, 40).map((lemma) => (
                          <button
                            key={lemma.key}
                            type="button"
                            onClick={() => updateLemmaTarget(lemma, "left")}
                            className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-teal-900 hover:border-teal-300 hover:bg-teal-100"
                            title={`Open this lemma in ${leftProjectName}`}
                          >
                            {lemma.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3">
                    <div className="text-sm font-semibold text-gray-800 mb-2">
                      Unique lemmas ({rightProjectName}) ({uniqueRightLemmas.length})
                    </div>
                    {uniqueRightLemmas.length === 0 ? (
                      <div className="text-sm text-gray-500">None</div>
                    ) : (
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        {uniqueRightLemmas.slice(0, 40).map((lemma) => (
                          <button
                            key={lemma.key}
                            type="button"
                            onClick={() => updateLemmaTarget(lemma, "right")}
                            className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-orange-900 hover:border-orange-300 hover:bg-orange-100"
                            title={`Open this lemma in ${rightProjectName}`}
                          >
                            {lemma.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-800">
                    Shared typological meanings ({sharedConcepts.length})
                  </div>
                  {sharedConcepts.length === 0 ? (
                    <div className="text-sm text-gray-500">No shared typological meanings found.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                      {sharedConcepts.slice(0, 40).map((concept) => (
                        <span key={concept} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5">
                          {concept}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Global Footer */}
      <GlobalFooter />
    </div>
  );
}
