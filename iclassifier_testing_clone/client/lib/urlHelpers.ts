/**
 * URL Navigation Utilities
 * Helper functions for the new project-based URL structure
 */

export interface NavigationHelpers {
  lemmaReport: (projectId: string, lemmaId?: number) => string;
  classifierReport: (projectId: string, classifierId?: string) => string;
  queryReport: (projectId: string) => string;
  mapReport: (projectId: string) => string;
}

export const urlHelpers: NavigationHelpers = {
  lemmaReport: (projectId: string, lemmaId?: number) => {
    const basePath = `/project/${projectId}/lemma`;
    return lemmaId ? `${basePath}/${lemmaId}` : basePath;
  },
  
  classifierReport: (projectId: string, classifierId?: string) => {
    const basePath = `/project/${projectId}/classifier`;
    return classifierId ? `${basePath}/${classifierId}` : basePath;
  },
  
  queryReport: (projectId: string) => `/project/${projectId}/query-report`,
  
  mapReport: (projectId: string) => `/project/${projectId}/network`
};

/**
 * Extract project and page info from current URL
 */
export function parseCurrentUrl(pathname: string) {
  // Match pattern: /project/{projectId}/{reportType}/{optionalId}
  const match = pathname.match(/^\/project\/([^\/]+)\/([^\/]+)(?:\/([^\/]+))?/);
  
  if (!match) {
    return {
      projectId: null,
      reportType: null,
      itemId: null,
      isProjectUrl: false
    };
  }
  
  const [, projectId, reportType, itemId] = match;
  
  return {
    projectId,
    reportType,
    itemId,
    isProjectUrl: true
  };
}

/**
 * Check if two URLs represent the same page (ignoring optional IDs)
 */
export function isSamePage(url1: string, url2: string): boolean {
  const parsed1 = parseCurrentUrl(url1);
  const parsed2 = parseCurrentUrl(url2);
  
  return parsed1.projectId === parsed2.projectId && 
         parsed1.reportType === parsed2.reportType;
}

/**
 * Legacy URL support - convert old query parameter URLs to new structure
 */
export function convertLegacyUrl(search: string, pathname: string): string | null {
  const params = new URLSearchParams(search);
  const projectId = params.get('projectId');
  const lemmaId = params.get('lemmaId');
  const classifierId = params.get('classifierId');
  
  if (!projectId) return null;
  
  // Convert based on current pathname
  if (pathname === '/lemma') {
    return urlHelpers.lemmaReport(projectId, lemmaId ? parseInt(lemmaId) : undefined);
  } else if (pathname === '/classifier') {
    return urlHelpers.classifierReport(projectId, classifierId || undefined);
  } else if (pathname === '/query-report') {
    return urlHelpers.queryReport(projectId);
  } else if (pathname === '/network') {
    return urlHelpers.mapReport(projectId);
  }
  
  return null;
}