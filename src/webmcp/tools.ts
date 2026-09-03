import { bedslingerDevice, componentById } from "../devices/bedslinger/components";
import {
  getEvidenceGuidanceForLatestObservation,
  getEvidenceGuidanceForObservation,
  useRepairBenchStore,
} from "../store/repairbench-store";
import type { ComponentId, EvidenceReference, HypothesisStatus, ToolResult } from "../domain/types";
import type { WebMcpTool } from "./types";

const revision = () => useRepairBenchStore.getState().session.revision;
const success = <T,>(data: T): ToolResult<T> => ({ ok: true, stateRevision: revision(), data });
const failure = (code: "invalid_input" | "not_found" | "invalid_state" | "unsupported", message: string): ToolResult<never> => ({
  ok: false,
  stateRevision: revision(),
  error: { code, message },
});

const objectInput = (input: unknown): Record<string, unknown> | null =>
  typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : null;

const isComponentId = (id: unknown): id is ComponentId => typeof id === "string" && id in componentById;
const statuses: HypothesisStatus[] = ["likely", "possible", "unlikely", "eliminated", "confirmed"];

const observationRequestResult = (testId: string, requestId: string) => {
  const state = useRepairBenchStore.getState();
  const test = state.session.tests.find((item) => item.id === testId);
  const request = state.session.observationRequests.find((item) => item.id === requestId);
  if (!test || !request) return failure("invalid_state", "The observation request could not be read.");
  return success({
    requestId,
    testId,
    status: "awaiting_human" as const,
    interaction: "ask_in_chat" as const,
    prompt: request.prompt,
    question: request.question,
    instructions: test.instructions,
    options: test.resultOptions.filter((option) => request.optionIds.includes(option.id)),
    nextTool: "record_test_result" as const,
  });
};

const activeDiagnosticSnapshot = () => {
  const state = useRepairBenchStore.getState();
  const pendingObservations = state.session.observationRequests.filter((item) => item.status === "awaiting_human");
  return {
    id: state.session.id,
    complaint: state.session.complaint,
    category: state.session.category,
    mode: state.session.mode,
    revision: state.session.revision,
    activeTests: state.session.tests.filter((item) => item.status === "active" || item.status === "pending"),
    completedTests: state.session.tests.filter((item) => item.status === "completed"),
    pendingObservations,
    observations: state.session.observations,
    hypotheses: state.session.hypotheses,
    suggestedEvidenceEffects: getEvidenceGuidanceForLatestObservation(),
    safety: {
      manualMotionRequiresPowerOff: true,
      keepHandsClearWhilePowered: true,
      neverTouchHotendWithoutTemperatureGuidance: true,
    },
  };
};

export const baseTools: WebMcpTool[] = [
  {
    name: "get_device",
    description: "Read the semantic device, system, and component registry for the current RepairBench workspace.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () => {
      useRepairBenchStore.getState().recordAgentActivity("Agent inspected the device model");
      return success(bedslingerDevice);
    },
  },
  {
    name: "get_active_diagnostic",
    description: "Read the current complaint, tests, human observations, hypotheses, and evidence guidance. Re-read this after a human completes an observation in the UI.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () => {
      useRepairBenchStore.getState().recordAgentActivity("Agent read the active diagnostic");
      return success(activeDiagnosticSnapshot());
    },
  },
  {
    name: "get_selected_component",
    description: "Read the component explicitly selected by the human. Agent focus and highlights do not change this value.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () => {
      const id = useRepairBenchStore.getState().viewer.humanSelectedComponentId;
      return success(id ? componentById[id] : null);
    },
  },
  {
    name: "highlight_components",
    description: "Ask the human to look at one or more semantic components. These amber agent highlights are separate from blue human selection.",
    inputSchema: {
      type: "object",
      required: ["componentIds"],
      properties: {
        componentIds: { type: "array", minItems: 1, maxItems: 8, uniqueItems: true, items: { type: "string" } },
        emphasis: { type: "string", enum: ["normal", "warning"] },
      },
      additionalProperties: false,
    },
    execute: (input) => {
      const value = objectInput(input);
      const ids = value?.componentIds;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 8 || !ids.every(isComponentId)) {
        return failure("invalid_input", "componentIds must contain 1–8 valid component IDs.");
      }
      const emphasis = value?.emphasis === "warning" ? "warning" : "normal";
      useRepairBenchStore.getState().setAgentHighlights(ids, emphasis);
      useRepairBenchStore.getState().recordAgentActivity(`Agent highlighted ${ids.map((id) => componentById[id].name).join(", ")}`, ids);
      return success({ componentIds: ids, emphasis });
    },
  },
  {
    name: "clear_agent_highlights",
    description: "Clear amber agent highlights and agent-created motion explanations without changing the human selection.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () => {
      useRepairBenchStore.getState().clearAgentHighlights();
      useRepairBenchStore.getState().recordAgentActivity("Agent cleared visual emphasis");
      return success({ cleared: true });
    },
  },
  {
    name: "focus_component",
    description: "Move the camera to a component and highlight it in amber. This never changes the human-selected component or dynamic tool context.",
    inputSchema: {
      type: "object",
      required: ["componentId"],
      properties: { componentId: { type: "string" } },
      additionalProperties: false,
    },
    execute: (input) => {
      const id = objectInput(input)?.componentId;
      if (!isComponentId(id)) return failure("not_found", "Unknown componentId.");
      useRepairBenchStore.getState().focusComponent(id);
      useRepairBenchStore.getState().recordAgentActivity(`Agent focused ${componentById[id].name}`, [id]);
      return success({ componentId: id });
    },
  },
  {
    name: "show_motion",
    description: "Animate a safe, predefined mechanical motion explanation in the device viewer.",
    inputSchema: {
      type: "object",
      required: ["motionPresetId"],
      properties: { motionPresetId: { type: "string", enum: ["y_bed_travel", "y_pulley_rotation", "endstop_trigger"] } },
      additionalProperties: false,
    },
    execute: (input) => {
      const preset = objectInput(input)?.motionPresetId;
      if (preset !== "y_bed_travel" && preset !== "y_pulley_rotation" && preset !== "endstop_trigger") {
        return failure("invalid_input", "Unknown motionPresetId.");
      }
      useRepairBenchStore.getState().showMotion(preset);
      useRepairBenchStore.getState().recordAgentActivity(`Agent started ${preset.replaceAll("_", " ")} animation`);
      return success({ motionPresetId: preset });
    },
  },
  {
    name: "show_motion_path",
    description: "Show a predefined component-to-component power or motion path. Use y_powertrain for the canonical Y-axis explanation.",
    inputSchema: {
      type: "object",
      required: ["motionPathId"],
      properties: { motionPathId: { type: "string", enum: ["y_powertrain", "y_belt_loop"] } },
      additionalProperties: false,
    },
    execute: (input) => {
      const pathId = objectInput(input)?.motionPathId;
      if (pathId !== "y_powertrain" && pathId !== "y_belt_loop") return failure("invalid_input", "Unknown motionPathId.");
      const ids: ComponentId[] = pathId === "y_powertrain" ? ["y_stepper", "y_drive_pulley", "y_belt", "bed_carriage", "bed"] : ["y_drive_pulley", "y_belt", "y_idler"];
      useRepairBenchStore.getState().setAgentHighlights(ids);
      useRepairBenchStore.getState().showMotionPath(pathId);
      useRepairBenchStore.getState().showMotion(pathId === "y_powertrain" ? "y_bed_travel" : null);
      useRepairBenchStore.getState().recordAgentActivity("Agent displayed the Y-axis motion path", ids);
      return success({ motionPathId: pathId, componentIds: ids });
    },
  },
  {
    name: "create_test",
    description: "Create a safe local diagnostic test from an allowlisted RepairBench template. The canonical template is manual_y_motion.",
    inputSchema: {
      type: "object",
      required: ["templateId"],
      properties: { templateId: { type: "string", enum: ["manual_y_motion", "y_belt_condition", "y_pulley_condition", "rear_homing_behavior"] } },
      additionalProperties: false,
    },
    execute: (input) => {
      const templateId = objectInput(input)?.templateId;
      if (typeof templateId !== "string") return failure("invalid_input", "templateId is required.");
      const result = useRepairBenchStore.getState().createTestFromTemplate(templateId);
      if (!result) return failure("unsupported", "Unknown or unsafe test template.");
      useRepairBenchStore.getState().recordAgentActivity(result.created ? `Agent created ${templateId.replaceAll("_", " ")} test` : `Agent reused the existing ${templateId.replaceAll("_", " ")} test`, [result.testId]);
      return success(result);
    },
  },
  {
    name: "request_observation",
    description: "Activate a created test and return a safe question with allowed answers. Present the question to the human in chat, end your turn, and after their reply call record_test_result with the matching option ID. Never invent the human's result.",
    inputSchema: {
      type: "object",
      required: ["testId"],
      properties: { testId: { type: "string", minLength: 1, maxLength: 100 } },
      additionalProperties: false,
    },
    execute: (input) => {
      const testId = objectInput(input)?.testId;
      if (typeof testId !== "string") return failure("invalid_input", "testId is required.");
      const requestId = useRepairBenchStore.getState().requestObservation(testId);
      if (!requestId) return failure("invalid_state", "The test does not exist or cannot accept an observation.");
      useRepairBenchStore.getState().recordAgentActivity("Agent requested a physical observation in chat", [requestId, testId]);
      return observationRequestResult(testId, requestId);
    },
  },
  {
    name: "record_test_result",
    description: "Record a structured result after the human explicitly answers an active diagnostic question in the current chat. Match their answer to one of the option IDs returned by request_observation. Returns an evidence reference and suggested hypothesis effects; apply supported effects with update_hypothesis in the same turn.",
    inputSchema: {
      type: "object",
      required: ["testId", "resultOptionId"],
      properties: {
        testId: { type: "string", minLength: 1, maxLength: 100 },
        resultOptionId: {
          type: "string",
          enum: [
            "moves_freely",
            "some_resistance",
            "gets_stuck",
            "normal",
            "loose",
            "too_tight",
            "damaged",
            "secure",
            "wobbling",
            "unknown",
            "triggers_normally",
            "does_not_trigger",
            "intermittent",
          ],
        },
        notes: { type: "string", maxLength: 500 },
      },
      additionalProperties: false,
    },
    execute: (input) => {
      const value = objectInput(input);
      const testId = value?.testId;
      const resultOptionId = value?.resultOptionId;
      const notes = value?.notes;
      if (
        typeof testId !== "string"
        || typeof resultOptionId !== "string"
        || (notes !== undefined && typeof notes !== "string")
        || (typeof notes === "string" && notes.length > 500)
      ) {
        return failure("invalid_input", "testId and resultOptionId are required; notes must be text of at most 500 characters.");
      }

      const before = useRepairBenchStore.getState().session;
      const test = before.tests.find((item) => item.id === testId);
      if (!test) return failure("not_found", "Unknown testId.");
      if (!test.resultOptions.some((option) => option.id === resultOptionId)) {
        return failure("invalid_input", "resultOptionId is not valid for this test.");
      }

      if (test.status === "completed") {
        const observation = before.observations.find((item) => item.id === test.observationId);
        if (!observation || observation.optionId !== resultOptionId) {
          return failure("invalid_state", "This test already has a different recorded result.");
        }
        return success({
          testId,
          status: "completed" as const,
          reused: true,
          observation,
          evidenceReference: { kind: "observation" as const, id: observation.id },
          suggestedEvidenceEffects: getEvidenceGuidanceForObservation(testId, observation.optionId),
        });
      }

      const request = before.observationRequests.find(
        (item) => item.testId === testId && item.status === "awaiting_human",
      );
      if (!request) return failure("invalid_state", "Call request_observation for this test before recording a result.");

      const observationId = useRepairBenchStore.getState().recordObservation(
        request.id,
        resultOptionId,
        "human_chat",
        typeof notes === "string" && notes.trim() ? notes.trim() : null,
      );
      if (!observationId) return failure("invalid_state", "The result could not be recorded.");

      const after = useRepairBenchStore.getState().session;
      const observation = after.observations.find((item) => item.id === observationId)!;
      const completedTest = after.tests.find((item) => item.id === testId)!;
      return success({
        testId,
        status: "completed" as const,
        reused: false,
        observation,
        test: completedTest,
        evidenceReference: { kind: "observation" as const, id: observationId },
        suggestedEvidenceEffects: getEvidenceGuidanceForObservation(testId, resultOptionId),
      });
    },
  },
  {
    name: "update_hypothesis",
    description: "Update a seeded hypothesis using explicit test or human-observation evidence. Supply concise reasoning; do not claim certainty unsupported by the recorded evidence.",
    inputSchema: {
      type: "object",
      required: ["hypothesisId", "status", "reasoning", "evidence"],
      properties: {
        hypothesisId: { type: "string", minLength: 1, maxLength: 100 },
        status: { type: "string", enum: statuses },
        reasoning: { type: "string", minLength: 5, maxLength: 500 },
        evidence: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            required: ["kind", "id"],
            properties: { kind: { type: "string", enum: ["observation", "test"] }, id: { type: "string" } },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    execute: (input) => {
      const value = objectInput(input);
      const hypothesisId = value?.hypothesisId;
      const status = value?.status;
      const reasoning = value?.reasoning;
      const rawEvidence = value?.evidence;
      if (typeof hypothesisId !== "string" || typeof reasoning !== "string" || reasoning.trim().length < 5 || !statuses.includes(status as HypothesisStatus) || !Array.isArray(rawEvidence)) {
        return failure("invalid_input", "hypothesisId, status, reasoning, and evidence are required.");
      }
      const evidence = rawEvidence.filter((item): item is EvidenceReference => {
        const ref = objectInput(item);
        return (ref?.kind === "observation" || ref?.kind === "test") && typeof ref.id === "string";
      });
      if (evidence.length !== rawEvidence.length) return failure("invalid_input", "Evidence references are malformed.");
      const session = useRepairBenchStore.getState().session;
      const allEvidenceExists = evidence.every((ref) =>
        ref.kind === "observation" ? session.observations.some((item) => item.id === ref.id) : session.tests.some((item) => item.id === ref.id),
      );
      if (!allEvidenceExists) return failure("not_found", "At least one evidence reference does not exist.");
      const updated = useRepairBenchStore.getState().updateHypothesis(hypothesisId, status as HypothesisStatus, reasoning.trim(), evidence);
      if (!updated) return failure("not_found", "Unknown hypothesisId.");
      useRepairBenchStore.getState().recordAgentActivity(`Agent marked a hypothesis ${String(status)}`, [hypothesisId]);
      return success({ hypothesisId, status, evidence });
    },
  },
];

const requestCondition = (templateId: string, label: string) => {
  const result = useRepairBenchStore.getState().createTestFromTemplate(templateId);
  if (!result) return failure("unsupported", "Inspection template is unavailable.");
  const requestId = useRepairBenchStore.getState().requestObservation(result.testId);
  if (!requestId) return failure("invalid_state", "Inspection cannot be requested in the current state.");
  useRepairBenchStore.getState().recordAgentActivity(`Agent requested ${label} in chat`, [result.testId, requestId]);
  return observationRequestResult(result.testId, requestId);
};

export const dynamicToolsForComponent = (componentId: ComponentId | null): WebMcpTool[] => {
  if (componentId === "y_belt") {
    return [
      {
        name: "inspect_belt",
        description: "Focus and explain the human-selected Y belt without recording a physical condition.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => {
          useRepairBenchStore.getState().focusComponent("y_belt");
          useRepairBenchStore.getState().recordAgentActivity("Agent inspected the selected Y-axis belt", ["y_belt"]);
          return success(componentById.y_belt);
        },
      },
      {
        name: "show_belt_path",
        description: "Trace the selected Y belt around the drive pulley and idler.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => baseTools.find((tool) => tool.name === "show_motion_path")!.execute({ motionPathId: "y_belt_loop" }),
      },
      {
        name: "request_belt_condition",
        description: "Create a safe belt inspection and return its question and allowed answers for you to present in chat. Record the human's reply with record_test_result.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => requestCondition("y_belt_condition", "a belt-condition observation"),
      },
    ];
  }

  if (componentId === "y_drive_pulley") {
    return [
      {
        name: "show_pulley_motion",
        description: "Animate the selected drive pulley and show how it transfers stepper rotation to the belt.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => {
          useRepairBenchStore.getState().setAgentHighlights(["y_stepper", "y_drive_pulley", "y_belt", "bed_carriage", "bed"]);
          useRepairBenchStore.getState().showMotion("y_pulley_rotation");
          useRepairBenchStore.getState().showMotionPath("y_powertrain");
          useRepairBenchStore.getState().recordAgentActivity("Agent showed how pulley slip causes position loss", ["y_drive_pulley", "y_belt", "bed"]);
          return success({ motionPresetId: "y_pulley_rotation", motionPathId: "y_powertrain" });
        },
      },
      {
        name: "request_pulley_condition",
        description: "Create a safe pulley inspection and return its question and allowed answers for you to present in chat. Record the human's reply with record_test_result.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => requestCondition("y_pulley_condition", "a pulley-condition observation"),
      },
    ];
  }

  if (componentId === "y_endstop") {
    return [
      {
        name: "show_trigger_motion",
        description: "Animate how the bed carriage reaches the selected Y endstop.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => {
          useRepairBenchStore.getState().setAgentHighlights(["bed", "y_endstop"]);
          useRepairBenchStore.getState().showMotion("endstop_trigger");
          useRepairBenchStore.getState().recordAgentActivity("Agent showed the Y-endstop trigger motion", ["bed", "y_endstop"]);
          return success({ motionPresetId: "endstop_trigger" });
        },
      },
      {
        name: "request_endstop_behavior",
        description: "Create a safe rear-homing observation and return its question and allowed answers for you to present in chat. Record the human's reply with record_test_result.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: () => requestCondition("rear_homing_behavior", "an endstop-behavior observation"),
      },
    ];
  }

  return [];
};
