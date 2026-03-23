import { useCurrentProjectId } from "@/lib/projectContext";
import { useProjectContextOverride } from "@/context/ProjectContextOverride";

/**
 * Hook that returns the project ID to use for the current component.
 * If there's an override project ID (from split-view), it returns that.
 * Otherwise, it returns the project ID from the URL/context.
 */
export function useProjectIdOrOverride(): string {
  const currentProjectId = useCurrentProjectId();
  const { overrideProjectId } = useProjectContextOverride();

  return overrideProjectId || currentProjectId;
}
