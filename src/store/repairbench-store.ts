import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { componentById } from "../devices/bedslinger/components";
import { evidenceGuidance, testTemplates } from "../devices/bedslinger/knowledge";
import { createYDemoSession, DEMO_SEED_VERSION } from "../devices/bedslinger/scenarios/y-axis";
import type {
  ActivityItem,
  ComponentId,
  DiagnosticSession,
  EvidenceReference,
  HypothesisStatus,
  Observation,
  TimelineEvent,
  ViewerState,
} from "../domain/types";

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const initialViewerState = (): ViewerState => ({
  humanSelectedComponentId: null,
  hoveredComponentId: null,
  agentHighlightedComponentIds: [],
  agentEmphasis: "normal",
  isolatedComponentId: null,
  focusedComponentId: null,
  activeMotionPresetId: null,
  activeMotionPathId: null,
  cameraResetNonce: 0,
});

type HostState = {
  mode: "native" | "preview" | "unavailable";
  registeredToolNames: string[];
};

type NewSessionInput = {
  category: string;
  categoryLabel: string;
  complaint: string;
};

type RepairBenchStore = {
  session: DiagnosticSession;
  viewer: ViewerState;
  host: HostState;
  activity: ActivityItem[];
  resetDemo: () => void;
  ensureCompatibleDemo: () => void;
  startSession: (input: NewSessionInput) => string;
  setHumanSelection: (componentId: ComponentId | null) => void;
  setHoveredComponent: (componentId: ComponentId | null) => void;
  setAgentHighlights: (componentIds: ComponentId[], emphasis?: "normal" | "warning") => void;
  clearAgentHighlights: () => void;
  focusComponent: (componentId: ComponentId) => void;
  setIsolation: (componentId: ComponentId | null) => void;
  showMotion: (presetId: ViewerState["activeMotionPresetId"]) => void;
  showMotionPath: (pathId: ViewerState["activeMotionPathId"]) => void;
  resetCamera: () => void;
  createTestFromTemplate: (templateId: string) => { testId: string; created: boolean } | null;
  requestObservation: (testId: string) => string | null;
  recordObservation: (requestId: string, optionId: string, source: Observation["source"], notes?: string | null) => string | null;
  submitObservation: (requestId: string, optionId: string) => boolean;
  updateHypothesis: (
    hypothesisId: string,
    status: HypothesisStatus,
    reasoning: string,
    evidence: EvidenceReference[],
  ) => boolean;
  setHostState: (host: Partial<HostState>) => void;
  recordAgentActivity: (message: string, entityIds?: string[]) => void;
};

const event = (
  source: TimelineEvent["source"],
  type: TimelineEvent["type"],
  message: string,
  entityIds: string[],
): TimelineEvent => ({ id: uid("event"), source, type, message, entityIds, createdAt: now() });

const previewHypotheses = (category: string): DiagnosticSession["hypotheses"] => {
  const content: Record<string, Array<[string, string, ComponentId[]]>> = {
    extrusion: [
      ["clogged_nozzle", "Clogged nozzle", ["nozzle", "hotend"]],
      ["extruder_slip", "Extruder gear slipping", ["extruder", "extruder_gear"]],
      ["filament_path", "Restricted filament path", ["filament", "bowden_tube"]],
    ],
    first_layer: [
      ["nozzle_high", "Nozzle too high", ["nozzle", "bed"]],
      ["nozzle_low", "Nozzle too low", ["nozzle", "bed"]],
      ["surface_condition", "Build surface condition", ["bed"]],
    ],
    stringing: [
      ["temperature", "Temperature too high", ["hotend", "nozzle"]],
      ["retraction", "Retraction mismatch", ["extruder", "bowden_tube", "nozzle"]],
    ],
    fused_parts: [
      ["clearance", "Insufficient joint clearance", ["nozzle", "bed"]],
      ["overextrusion", "Excess material flow", ["extruder", "nozzle"]],
      ["temperature", "Print temperature too high", ["hotend", "nozzle"]],
    ],
  };

  return (content[category] ?? []).map(([id, title, componentIds]) => ({
    id,
    title,
    description: "Seeded diagnostic knowledge for this preview workflow.",
    componentIds,
    status: "possible" as const,
    evidenceFor: [],
    evidenceAgainst: [],
    reasoning: "This category is available as a product preview in v0.1.",
  }));
};

export const useRepairBenchStore = create<RepairBenchStore>()(
  persist(
    (set, get) => ({
      session: createYDemoSession(),
      viewer: initialViewerState(),
      host: { mode: "preview", registeredToolNames: [] },
      activity: [],

      resetDemo: () =>
        set({
          session: createYDemoSession(),
          viewer: initialViewerState(),
          activity: [{ id: uid("activity"), message: "Demo restored to its starting state", createdAt: now() }],
        }),

      ensureCompatibleDemo: () => {
        const { session } = get();
        if (session.mode === "demo" && session.seedVersion !== DEMO_SEED_VERSION) get().resetDemo();
      },

      startSession: ({ category, categoryLabel, complaint }) => {
        const id = `RB-${Math.floor(100 + Math.random() * 900)}`;
        const createdAt = now();
        const session: DiagnosticSession = {
          id,
          seedVersion: DEMO_SEED_VERSION,
          deviceId: "generic_cartesian_bedslinger",
          category,
          categoryLabel,
          complaint,
          mode: category === "movement" ? "standard" : "preview",
          createdAt,
          tests: [],
          observationRequests: [],
          observations: [],
          hypotheses: category === "movement" ? createYDemoSession().hypotheses : previewHypotheses(category),
          timeline: [event("system", "session_started", `${categoryLabel} diagnostic opened`, [id])],
          revision: 0,
        };
        set({ session, viewer: initialViewerState(), activity: [] });
        return id;
      },

      setHumanSelection: (componentId) => {
        const current = get().viewer.humanSelectedComponentId;
        if (current === componentId) return;
        const message = componentId ? `${componentById[componentId].name} selected` : "Component selection cleared";
        set((state) => ({
          viewer: { ...state.viewer, humanSelectedComponentId: componentId },
          session: {
            ...state.session,
            revision: state.session.revision + 1,
            timeline: [...state.session.timeline, event("human_ui", "component_selected", message, componentId ? [componentId] : [])],
          },
        }));
      },

      setHoveredComponent: (componentId) => set((state) => ({ viewer: { ...state.viewer, hoveredComponentId: componentId } })),

      setAgentHighlights: (componentIds, emphasis = "normal") =>
        set((state) => ({ viewer: { ...state.viewer, agentHighlightedComponentIds: componentIds, agentEmphasis: emphasis } })),

      clearAgentHighlights: () =>
        set((state) => ({
          viewer: {
            ...state.viewer,
            agentHighlightedComponentIds: [],
            activeMotionPathId: null,
            activeMotionPresetId: null,
          },
        })),

      focusComponent: (componentId) =>
        set((state) => ({
          viewer: {
            ...state.viewer,
            focusedComponentId: componentId,
            agentHighlightedComponentIds: Array.from(new Set([...state.viewer.agentHighlightedComponentIds, componentId])),
          },
        })),

      setIsolation: (componentId) => set((state) => ({ viewer: { ...state.viewer, isolatedComponentId: componentId } })),
      showMotion: (presetId) => set((state) => ({ viewer: { ...state.viewer, activeMotionPresetId: presetId } })),
      showMotionPath: (pathId) => set((state) => ({ viewer: { ...state.viewer, activeMotionPathId: pathId } })),
      resetCamera: () => set((state) => ({ viewer: { ...state.viewer, cameraResetNonce: state.viewer.cameraResetNonce + 1, focusedComponentId: null } })),

      createTestFromTemplate: (templateId) => {
        const template = testTemplates[templateId];
        if (!template) return null;
        const existing = get().session.tests.find((test) => test.templateId === templateId && test.status !== "skipped");
        if (existing) return { testId: existing.id, created: false };
        const testId = `test-${templateId}`;
        set((state) => ({
          session: {
            ...state.session,
            revision: state.session.revision + 1,
            tests: [
              ...state.session.tests,
              {
                id: testId,
                templateId,
                title: template.title,
                purpose: template.purpose,
                instructions: [...template.instructions],
                componentIds: [...template.componentIds],
                resultOptions: template.resultOptions.map((option) => ({ ...option })),
                status: "pending",
                resultOptionId: null,
                observationId: null,
              },
            ],
            timeline: [...state.session.timeline, event("agent_tool", "test_created", `${template.title} test created`, [testId])],
          },
        }));
        return { testId, created: true };
      },

      requestObservation: (testId) => {
        const state = get();
        const test = state.session.tests.find((item) => item.id === testId);
        if (!test || test.status === "completed") return null;
        const existing = state.session.observationRequests.find((request) => request.testId === testId && request.status === "awaiting_human");
        if (existing) return existing.id;
        const template = testTemplates[test.templateId];
        if (!template) return null;
        const requestId = `request-${test.id}`;
        set((current) => ({
          viewer: {
            ...current.viewer,
            agentHighlightedComponentIds: [...test.componentIds],
          },
          session: {
            ...current.session,
            revision: current.session.revision + 1,
            tests: current.session.tests.map((item) => (item.id === testId ? { ...item, status: "active" } : item)),
            observationRequests: [
              ...current.session.observationRequests,
              {
                id: requestId,
                testId,
                prompt: template.prompt,
                question: template.question,
                optionIds: template.resultOptions.map((option) => option.id),
                status: "awaiting_human",
                createdAt: now(),
              },
            ],
            timeline: [...current.session.timeline, event("agent_tool", "observation_requested", `Human observation requested: ${template.title}`, [requestId, testId])],
          },
        }));
        return requestId;
      },

      recordObservation: (requestId, optionId, source, notes = null) => {
        const state = get();
        const request = state.session.observationRequests.find((item) => item.id === requestId && item.status === "awaiting_human");
        if (!request) return null;
        const test = state.session.tests.find((item) => item.id === request.testId);
        const option = test?.resultOptions.find((item) => item.id === optionId);
        if (!test || !option || !request.optionIds.includes(optionId)) return null;
        const observationId = `observation-${test.templateId}-${state.session.observations.length + 1}`;
        const timelineSource = source === "human_ui" ? "human_ui" : "agent_tool";
        const activityMessage = source === "human_ui"
          ? `You recorded “${option.label}”`
          : `Agent recorded your chat response “${option.label}”`;
        set((current) => ({
          session: {
            ...current.session,
            revision: current.session.revision + 1,
            tests: current.session.tests.map((item) =>
              item.id === test.id ? { ...item, status: "completed", resultOptionId: option.id, observationId } : item,
            ),
            observationRequests: current.session.observationRequests.map((item) =>
              item.id === requestId ? { ...item, status: "completed" } : item,
            ),
            observations: [
              ...current.session.observations,
              {
                id: observationId,
                requestId,
                testId: test.id,
                optionId: option.id,
                label: option.label,
                source,
                notes,
                createdAt: now(),
              },
            ],
            timeline: [...current.session.timeline, event(timelineSource, "observation_recorded", `${test.title}: ${option.label}`, [observationId, test.id])],
          },
          activity: [{ id: uid("activity"), message: activityMessage, createdAt: now() }, ...current.activity].slice(0, 12),
        }));
        return observationId;
      },

      submitObservation: (requestId, optionId) =>
        Boolean(get().recordObservation(requestId, optionId, "human_ui")),

      updateHypothesis: (hypothesisId, status, reasoning, evidence) => {
        const state = get();
        const hypothesis = state.session.hypotheses.find((item) => item.id === hypothesisId);
        if (!hypothesis) return false;
        const against = status === "unlikely" || status === "eliminated";
        set((current) => ({
          session: {
            ...current.session,
            revision: current.session.revision + 1,
            hypotheses: current.session.hypotheses.map((item) =>
              item.id === hypothesisId
                ? {
                    ...item,
                    status,
                    reasoning,
                    evidenceFor: against ? item.evidenceFor : Array.from(new Map([...item.evidenceFor, ...evidence].map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()),
                    evidenceAgainst: against ? Array.from(new Map([...item.evidenceAgainst, ...evidence].map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()) : item.evidenceAgainst,
                  }
                : item,
            ),
            timeline: [...current.session.timeline, event("agent_tool", "hypothesis_updated", `${hypothesis.title} marked ${status}`, [hypothesisId, ...evidence.map((item) => item.id)])],
          },
        }));
        return true;
      },

      setHostState: (host) => set((state) => ({ host: { ...state.host, ...host } })),

      recordAgentActivity: (message, entityIds = []) =>
        set((state) => ({
          activity: [{ id: uid("activity"), message, createdAt: now() }, ...state.activity].slice(0, 12),
          session: {
            ...state.session,
            timeline: [...state.session.timeline, event("agent_tool", "agent_action", message, entityIds)],
          },
        })),
    }),
    {
      name: "repairbench-state-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
);

export const getEvidenceGuidanceForObservation = (testId: string, optionId: string) => {
  const { tests } = useRepairBenchStore.getState().session;
  const test = tests.find((item) => item.id === testId);
  return test ? evidenceGuidance[`${test.templateId}:${optionId}`] ?? [] : [];
};

export const getEvidenceGuidanceForLatestObservation = () => {
  const { observations } = useRepairBenchStore.getState().session;
  const latest = observations.at(-1);
  return latest ? getEvidenceGuidanceForObservation(latest.testId, latest.optionId) : [];
};
