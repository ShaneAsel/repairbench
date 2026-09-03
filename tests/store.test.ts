import { beforeEach, describe, expect, it } from "vitest";
import { useRepairBenchStore } from "../src/store/repairbench-store";

describe("RepairBench diagnostic store", () => {
  beforeEach(() => {
    localStorage.clear();
    useRepairBenchStore.getState().resetDemo();
  });

  it("restores the deterministic Y-axis seed", () => {
    const state = useRepairBenchStore.getState();
    expect(state.session.id).toBe("demo-y-axis");
    expect(state.session.complaint).toContain("comes forward");
    expect(state.session.hypotheses).toHaveLength(5);
    expect(state.session.tests).toHaveLength(0);
    expect(state.viewer.humanSelectedComponentId).toBeNull();
  });

  it("keeps agent focus separate from human selection", () => {
    const store = useRepairBenchStore.getState();
    store.focusComponent("y_drive_pulley");

    const state = useRepairBenchStore.getState();
    expect(state.viewer.focusedComponentId).toBe("y_drive_pulley");
    expect(state.viewer.agentHighlightedComponentIds).toContain("y_drive_pulley");
    expect(state.viewer.humanSelectedComponentId).toBeNull();
  });

  it("only creates a physical observation through the human submission action", () => {
    const store = useRepairBenchStore.getState();
    const created = store.createTestFromTemplate("manual_y_motion");
    expect(created).toEqual({ testId: "test-manual_y_motion", created: true });

    const requestId = useRepairBenchStore.getState().requestObservation(created!.testId);
    expect(requestId).toBe("request-test-manual_y_motion");
    expect(useRepairBenchStore.getState().session.observations).toHaveLength(0);

    const submitted = useRepairBenchStore.getState().submitObservation(requestId!, "moves_freely");
    expect(submitted).toBe(true);

    const state = useRepairBenchStore.getState();
    expect(state.session.observations).toHaveLength(1);
    expect(state.session.observations[0]).toMatchObject({
      optionId: "moves_freely",
      source: "human_ui",
      testId: "test-manual_y_motion",
    });
    expect(state.session.tests[0]).toMatchObject({ status: "completed", resultOptionId: "moves_freely" });
  });

  it("deduplicates creation of the same active test template", () => {
    const first = useRepairBenchStore.getState().createTestFromTemplate("manual_y_motion");
    const second = useRepairBenchStore.getState().createTestFromTemplate("manual_y_motion");
    expect(first?.created).toBe(true);
    expect(second).toEqual({ testId: first?.testId, created: false });
    expect(useRepairBenchStore.getState().session.tests).toHaveLength(1);
  });
});
