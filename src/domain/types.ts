export type ComponentId =
  | "frame"
  | "gantry"
  | "x_rail"
  | "bed"
  | "bed_carriage"
  | "y_rail"
  | "y_belt"
  | "y_stepper"
  | "y_drive_pulley"
  | "y_idler"
  | "y_endstop"
  | "toolhead"
  | "hotend"
  | "nozzle"
  | "part_cooling_fan"
  | "hotend_fan"
  | "extruder"
  | "extruder_gear"
  | "bowden_tube"
  | "filament"
  | "z_stepper"
  | "z_leadscrew";

export type SystemId = "frame" | "y_axis" | "x_axis" | "toolhead" | "extrusion" | "z_axis";

export type DeviceComponent = {
  id: ComponentId;
  name: string;
  system: SystemId;
  purpose: string;
  relatedSymptoms: string[];
  relevantTests: string[];
};

export type Device = {
  id: string;
  name: string;
  category: "fdm_3d_printer";
  systems: Array<{ id: SystemId; name: string; componentIds: ComponentId[] }>;
  components: DeviceComponent[];
};

export type TestStatus = "pending" | "active" | "completed" | "skipped";

export type TestResultOption = {
  id: string;
  label: string;
};

export type DiagnosticTest = {
  id: string;
  templateId: string;
  title: string;
  purpose: string;
  instructions: string[];
  componentIds: ComponentId[];
  resultOptions: TestResultOption[];
  status: TestStatus;
  resultOptionId: string | null;
  observationId: string | null;
};

export type ObservationRequest = {
  id: string;
  testId: string;
  prompt: string;
  question: string;
  optionIds: string[];
  status: "awaiting_human" | "completed" | "cancelled";
  createdAt: string;
};

export type Observation = {
  id: string;
  requestId: string;
  testId: string;
  optionId: string;
  label: string;
  source: "human_ui" | "human_chat";
  notes: string | null;
  createdAt: string;
};

export type EvidenceReference = {
  kind: "observation" | "test";
  id: string;
};

export type HypothesisStatus = "likely" | "possible" | "unlikely" | "eliminated" | "confirmed";

export type Hypothesis = {
  id: string;
  title: string;
  description: string;
  componentIds: ComponentId[];
  status: HypothesisStatus;
  evidenceFor: EvidenceReference[];
  evidenceAgainst: EvidenceReference[];
  reasoning: string | null;
};

export type TimelineEvent = {
  id: string;
  source: "human_ui" | "agent_tool" | "system";
  type:
    | "session_started"
    | "component_selected"
    | "test_created"
    | "observation_requested"
    | "observation_recorded"
    | "hypothesis_updated"
    | "agent_action"
    | "context_tools_changed";
  message: string;
  entityIds: string[];
  createdAt: string;
};

export type DiagnosticSession = {
  id: string;
  seedVersion: number;
  deviceId: string;
  category: string;
  categoryLabel: string;
  complaint: string;
  mode: "demo" | "preview" | "standard";
  createdAt: string;
  tests: DiagnosticTest[];
  observationRequests: ObservationRequest[];
  observations: Observation[];
  hypotheses: Hypothesis[];
  timeline: TimelineEvent[];
  revision: number;
};

export type ViewerState = {
  humanSelectedComponentId: ComponentId | null;
  hoveredComponentId: ComponentId | null;
  agentHighlightedComponentIds: ComponentId[];
  agentEmphasis: "normal" | "warning";
  isolatedComponentId: ComponentId | null;
  focusedComponentId: ComponentId | null;
  activeMotionPresetId: "y_bed_travel" | "y_pulley_rotation" | "endstop_trigger" | null;
  activeMotionPathId: "y_powertrain" | "y_belt_loop" | null;
  cameraResetNonce: number;
};

export type ToolErrorCode =
  | "invalid_input"
  | "not_found"
  | "invalid_state"
  | "unsupported"
  | "stale_revision"
  | "internal_error";

export type ToolResult<T> =
  | { ok: true; stateRevision: number; data: T }
  | { ok: false; stateRevision: number; error: { code: ToolErrorCode; message: string } };

export type ActivityItem = {
  id: string;
  message: string;
  createdAt: string;
};
