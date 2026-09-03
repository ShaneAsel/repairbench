import type { DiagnosticSession, Hypothesis, TimelineEvent } from "../../../domain/types";

export const DEMO_SEED_VERSION = 2;
export const DEMO_SESSION_ID = "demo-y-axis";

const initialHypotheses: Hypothesis[] = [
  {
    id: "physical_obstruction",
    title: "Physical obstruction",
    description: "Debris, a snag, or rail binding interrupts the bed's travel.",
    componentIds: ["bed", "bed_carriage", "y_rail"],
    status: "possible",
    evidenceFor: [],
    evidenceAgainst: [],
    reasoning: "The directional grinding could come from resistance along the travel path.",
  },
  {
    id: "belt_tension_issue",
    title: "Belt tension issue",
    description: "A loose, overtightened, or damaged belt transfers motion inconsistently.",
    componentIds: ["y_belt", "y_drive_pulley", "y_idler"],
    status: "possible",
    evidenceFor: [],
    evidenceAgainst: [],
    reasoning: "Grinding plus layer shifts can indicate lost belt motion.",
  },
  {
    id: "loose_pulley",
    title: "Loose drive pulley",
    description: "The pulley slips on the stepper shaft instead of moving the belt predictably.",
    componentIds: ["y_drive_pulley", "y_stepper", "y_belt"],
    status: "possible",
    evidenceFor: [],
    evidenceAgainst: [],
    reasoning: "Pulley slip can produce directional position loss without constant binding.",
  },
  {
    id: "stepper_issue",
    title: "Stepper or driver issue",
    description: "The motor or its driver loses torque or skips commanded steps.",
    componentIds: ["y_stepper"],
    status: "possible",
    evidenceFor: [],
    evidenceAgainst: [],
    reasoning: "The failure appears during powered movement and changes machine position.",
  },
  {
    id: "endstop_issue",
    title: "Homing or endstop issue",
    description: "An unreliable endstop causes the machine to lose its Y-axis reference.",
    componentIds: ["y_endstop", "bed", "y_stepper"],
    status: "possible",
    evidenceFor: [],
    evidenceAgainst: [],
    reasoning: "Directional grinding can occur when the controller believes the bed is elsewhere.",
  },
];

export const createYDemoSession = (): DiagnosticSession => {
  const now = new Date().toISOString();
  const initialEvent: TimelineEvent = {
    id: "event-demo-started",
    source: "system",
    type: "session_started",
    message: "Y-axis diagnostic opened",
    entityIds: [DEMO_SESSION_ID],
    createdAt: now,
  };

  return {
    id: DEMO_SESSION_ID,
    seedVersion: DEMO_SEED_VERSION,
    deviceId: "generic_cartesian_bedslinger",
    category: "movement",
    categoryLabel: "Movement / Layer Shifting",
    complaint: "The bed moves backward normally, but when it comes forward it sometimes grinds and causes layer shifts.",
    mode: "demo",
    createdAt: now,
    tests: [],
    observationRequests: [],
    observations: [],
    hypotheses: initialHypotheses.map((item) => ({ ...item, componentIds: [...item.componentIds] })),
    timeline: [initialEvent],
    revision: 0,
  };
};
