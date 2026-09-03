import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { destroyWebMcp, initializeWebMcp } from "../src/webmcp/adapter";
import { useRepairBenchStore } from "../src/store/repairbench-store";
import type { WebMcpTool } from "../src/webmcp/types";

describe("WebMCP adapter", () => {
  beforeEach(() => {
    localStorage.clear();
    useRepairBenchStore.getState().resetDemo();
    Object.defineProperty(document, "modelContext", { value: undefined, configurable: true, writable: true });
  });

  afterEach(() => {
    destroyWebMcp();
    Object.defineProperty(document, "modelContext", { value: undefined, configurable: true, writable: true });
  });

  it("exposes the complete base surface in preview mode", () => {
    initializeWebMcp();
    expect(window.__repairbenchWebMcp?.mode).toBe("preview");
    expect(window.__repairbenchWebMcp?.listTools()).toEqual(expect.arrayContaining([
      "get_active_diagnostic",
      "get_selected_component",
      "highlight_components",
      "create_test",
      "request_observation",
      "record_test_result",
      "update_hypothesis",
    ]));
  });

  it("registers and removes pulley tools only after human selection", () => {
    initializeWebMcp();
    useRepairBenchStore.getState().focusComponent("y_drive_pulley");
    expect(window.__repairbenchWebMcp?.listTools()).not.toContain("show_pulley_motion");

    useRepairBenchStore.getState().setHumanSelection("y_drive_pulley");
    expect(window.__repairbenchWebMcp?.listTools()).toContain("show_pulley_motion");
    expect(window.__repairbenchWebMcp?.listTools()).toContain("request_pulley_condition");

    useRepairBenchStore.getState().setHumanSelection(null);
    expect(window.__repairbenchWebMcp?.listTools()).not.toContain("show_pulley_motion");
  });

  it("binds and unbinds tools through the native host contract", () => {
    const registered = new Map<string, WebMcpTool>();
    const registerTool = vi.fn(async (tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
      registered.set(tool.name, tool);
      options?.signal?.addEventListener("abort", () => registered.delete(tool.name), { once: true });
    });
    Object.defineProperty(document, "modelContext", {
      value: { registerTool },
      configurable: true,
      writable: true,
    });

    initializeWebMcp();
    expect(window.__repairbenchWebMcp?.mode).toBe("native");
    expect(registerTool).toHaveBeenCalled();
    expect(registered.has("get_active_diagnostic")).toBe(true);

    useRepairBenchStore.getState().setHumanSelection("y_belt");
    expect(registered.has("inspect_belt")).toBe(true);
    useRepairBenchStore.getState().setHumanSelection("y_endstop");
    expect(registered.has("inspect_belt")).toBe(false);
    expect(registered.has("show_trigger_motion")).toBe(true);
  });

  it("returns the chat question immediately and records the human's next chat answer", async () => {
    initializeWebMcp();
    const createResult = await window.__repairbenchWebMcp!.invoke("create_test", { templateId: "manual_y_motion" }) as any;
    expect(createResult.ok).toBe(true);
    const requestResult = await window.__repairbenchWebMcp!.invoke("request_observation", { testId: createResult.data.testId }) as any;
    expect(requestResult).toMatchObject({
      ok: true,
      data: {
        status: "awaiting_human",
        interaction: "ask_in_chat",
        question: "How does the bed move?",
        nextTool: "record_test_result",
      },
    });
    expect(requestResult.data.options).toEqual(expect.arrayContaining([
      { id: "moves_freely", label: "Moves freely" },
      { id: "some_resistance", label: "Some resistance" },
    ]));
    expect(useRepairBenchStore.getState().session.observations).toHaveLength(0);

    const recordResult = await window.__repairbenchWebMcp!.invoke("record_test_result", {
      testId: createResult.data.testId,
      resultOptionId: "some_resistance",
      notes: "The user explicitly reported this in chat.",
    });
    expect(recordResult).toMatchObject({
      ok: true,
      data: {
        status: "completed",
        reused: false,
        observation: { optionId: "some_resistance", label: "Some resistance", source: "human_chat" },
        test: { status: "completed", resultOptionId: "some_resistance" },
        evidenceReference: { kind: "observation" },
        suggestedEvidenceEffects: [{ hypothesisId: "physical_obstruction", status: "likely" }],
      },
    });
  });

  it("rejects a chat result that was not preceded by an observation request", async () => {
    initializeWebMcp();
    const createResult = await window.__repairbenchWebMcp!.invoke("create_test", { templateId: "manual_y_motion" }) as any;
    const recordResult = await window.__repairbenchWebMcp!.invoke("record_test_result", {
      testId: createResult.data.testId,
      resultOptionId: "moves_freely",
    }) as any;

    expect(recordResult).toMatchObject({ ok: false, error: { code: "invalid_state" } });
    expect(useRepairBenchStore.getState().session.observations).toHaveLength(0);
  });
});
