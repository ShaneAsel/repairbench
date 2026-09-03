import type { DiagnosticTest, HypothesisStatus } from "../../domain/types";

export type TestTemplate = Omit<DiagnosticTest, "id" | "status" | "resultOptionId" | "observationId"> & {
  prompt: string;
  question: string;
};

export const testTemplates: Record<string, TestTemplate> = {
  manual_y_motion: {
    templateId: "manual_y_motion",
    title: "Manual Y-axis Motion",
    purpose: "Determine whether resistance exists while the Y-axis motor is unpowered.",
    instructions: [
      "Power off the printer and wait for all motion to stop.",
      "Move the bed slowly toward the rear.",
      "Move it slowly toward the front.",
      "Stop immediately if the bed binds; do not force it.",
    ],
    componentIds: ["bed", "bed_carriage", "y_rail"],
    resultOptions: [
      { id: "moves_freely", label: "Moves freely" },
      { id: "some_resistance", label: "Some resistance" },
      { id: "gets_stuck", label: "Gets stuck" },
    ],
    prompt: "With the printer powered off, move the bed slowly through its full range of motion.",
    question: "How does the bed move?",
  },
  y_belt_condition: {
    templateId: "y_belt_condition",
    title: "Y-axis Belt Inspection",
    purpose: "Check whether the belt can transfer motion consistently.",
    instructions: ["Power off the printer.", "Inspect the belt for slack, excessive tension, fraying, or missing teeth.", "Do not place fingers near a powered pulley."],
    componentIds: ["y_belt", "y_drive_pulley", "y_idler"],
    resultOptions: [
      { id: "normal", label: "Normal" },
      { id: "loose", label: "Loose" },
      { id: "too_tight", label: "Too tight" },
      { id: "damaged", label: "Damaged" },
    ],
    prompt: "With the printer powered off, visually inspect and gently press the Y-axis belt.",
    question: "What is the belt condition?",
  },
  y_pulley_condition: {
    templateId: "y_pulley_condition",
    title: "Y-axis Drive Pulley Inspection",
    purpose: "Determine whether the drive pulley is secure on the stepper shaft.",
    instructions: ["Power off the printer.", "Locate the Y-axis drive pulley.", "Check visually for wobble or a loose set screw without forcing the mechanism."],
    componentIds: ["y_drive_pulley", "y_stepper", "y_belt"],
    resultOptions: [
      { id: "secure", label: "Secure" },
      { id: "loose", label: "Loose" },
      { id: "wobbling", label: "Wobbling" },
      { id: "unknown", label: "Unable to tell" },
    ],
    prompt: "With the printer powered off, inspect the Y-axis drive pulley and its set screw.",
    question: "What is the pulley condition?",
  },
  rear_homing_behavior: {
    templateId: "rear_homing_behavior",
    title: "Rear Homing Behavior",
    purpose: "Determine whether the rear Y-axis endstop establishes home reliably.",
    instructions: ["Keep hands clear of the moving bed.", "Start the normal homing command.", "Be ready to switch the printer off if motion continues after reaching the endstop."],
    componentIds: ["y_endstop", "bed", "y_stepper"],
    resultOptions: [
      { id: "triggers_normally", label: "Triggers normally" },
      { id: "does_not_trigger", label: "Does not trigger" },
      { id: "intermittent", label: "Intermittent" },
      { id: "unknown", label: "Unable to tell" },
    ],
    prompt: "Observe a normal Y-axis homing cycle without touching the moving printer.",
    question: "How does the rear endstop behave?",
  },
};

export const evidenceGuidance: Record<string, Array<{ hypothesisId: string; status: HypothesisStatus; rationale: string }>> = {
  "manual_y_motion:moves_freely": [
    { hypothesisId: "physical_obstruction", status: "unlikely", rationale: "Free unpowered travel argues against a persistent physical obstruction." },
  ],
  "manual_y_motion:some_resistance": [
    { hypothesisId: "physical_obstruction", status: "likely", rationale: "Resistance during unpowered travel points toward mechanical drag, debris, or rail binding." },
  ],
  "manual_y_motion:gets_stuck": [
    { hypothesisId: "physical_obstruction", status: "likely", rationale: "Binding during unpowered travel points to a mechanical obstruction or rail issue." },
  ],
  "y_belt_condition:normal": [
    { hypothesisId: "belt_tension_issue", status: "unlikely", rationale: "A visually sound belt with normal tension makes a belt fault less likely." },
  ],
  "y_belt_condition:loose": [
    { hypothesisId: "belt_tension_issue", status: "likely", rationale: "A loose belt can skip teeth and lose Y position during direction changes." },
  ],
  "y_belt_condition:too_tight": [
    { hypothesisId: "belt_tension_issue", status: "likely", rationale: "Excessive belt tension can add drag and reduce available stepper torque." },
  ],
  "y_belt_condition:damaged": [
    { hypothesisId: "belt_tension_issue", status: "likely", rationale: "Belt damage can interrupt motion transfer and cause position loss." },
  ],
  "y_pulley_condition:secure": [
    { hypothesisId: "loose_pulley", status: "unlikely", rationale: "A secure pulley makes shaft slippage less likely." },
  ],
  "y_pulley_condition:loose": [
    { hypothesisId: "loose_pulley", status: "likely", rationale: "A loose pulley can rotate without transferring the expected distance to the belt." },
  ],
  "y_pulley_condition:wobbling": [
    { hypothesisId: "loose_pulley", status: "likely", rationale: "Pulley wobble indicates an insecure or misaligned drive connection." },
  ],
  "rear_homing_behavior:triggers_normally": [
    { hypothesisId: "endstop_issue", status: "unlikely", rationale: "Repeatable rear homing makes an endstop fault less likely." },
  ],
  "rear_homing_behavior:does_not_trigger": [
    { hypothesisId: "endstop_issue", status: "likely", rationale: "Failure to trigger during homing directly supports an endstop or wiring fault." },
  ],
  "rear_homing_behavior:intermittent": [
    { hypothesisId: "endstop_issue", status: "likely", rationale: "Intermittent homing behavior supports an unreliable endstop signal." },
  ],
};
