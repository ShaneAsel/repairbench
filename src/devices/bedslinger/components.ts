import type { Device, DeviceComponent, ComponentId, SystemId } from "../../domain/types";

const component = (
  id: ComponentId,
  name: string,
  system: SystemId,
  purpose: string,
  relatedSymptoms: string[],
  relevantTests: string[] = [],
): DeviceComponent => ({ id, name, system, purpose, relatedSymptoms, relevantTests });

export const bedslingerComponents: DeviceComponent[] = [
  component("frame", "Base Frame", "frame", "Supports and aligns the printer's mechanical systems.", ["vibration", "dimensional errors"]),
  component("gantry", "Gantry", "frame", "Supports the X-axis and toolhead above the build surface.", ["layer inconsistency", "frame wobble"]),
  component("x_rail", "X-axis Rail", "x_axis", "Guides the toolhead from left to right.", ["X-axis shifts", "rough motion"]),
  component("bed", "Build Plate", "y_axis", "Supports the printed part and travels along the Y axis.", ["layer shifting", "poor adhesion"], ["manual_y_motion"]),
  component("bed_carriage", "Bed Carriage", "y_axis", "Carries the build plate and transfers belt motion to it.", ["binding", "layer shifting"], ["manual_y_motion"]),
  component("y_rail", "Y-axis Rails", "y_axis", "Guide the bed carriage through straight front-to-back motion.", ["binding", "grinding"], ["manual_y_motion"]),
  component("y_belt", "Y-axis Belt", "y_axis", "Transfers pulley rotation into linear carriage movement.", ["layer shifting", "position loss", "grinding"], ["y_belt_condition"]),
  component("y_stepper", "Y-axis Stepper", "y_axis", "Provides controlled rotational motion for the Y axis.", ["grinding", "skipped movement", "position loss"], ["powered_y_motion"]),
  component("y_drive_pulley", "Y-axis Drive Pulley", "y_axis", "Transfers stepper rotation into belt movement.", ["layer shifting", "grinding", "inconsistent Y motion", "position loss"], ["y_pulley_condition"]),
  component("y_idler", "Y-axis Idler", "y_axis", "Routes and tensions the return side of the Y belt.", ["belt wandering", "noise", "poor tension"], ["y_belt_condition"]),
  component("y_endstop", "Y-axis Endstop", "y_axis", "Provides the machine's Y-axis home reference.", ["homing failure", "grinding at travel limit"], ["rear_homing_behavior"]),
  component("toolhead", "Toolhead", "toolhead", "Carries the hotend and cooling system across the X axis.", ["surface artifacts", "X-axis shifts"]),
  component("hotend", "Hotend", "toolhead", "Melts filament at a controlled temperature.", ["under-extrusion", "stringing", "clogs"]),
  component("nozzle", "Nozzle", "toolhead", "Deposits molten filament onto the build surface.", ["clogging", "poor first layer", "stringing"]),
  component("part_cooling_fan", "Part Cooling Fan", "toolhead", "Cools newly deposited plastic.", ["poor bridges", "warping"]),
  component("hotend_fan", "Hotend Fan", "toolhead", "Prevents heat from traveling into the cold side of the hotend.", ["heat creep", "clogs"]),
  component("extruder", "Extruder", "extrusion", "Feeds filament toward the hotend.", ["slipping", "under-extrusion"]),
  component("extruder_gear", "Extruder Drive Gear", "extrusion", "Grips and advances filament.", ["filament grinding", "slipping"]),
  component("bowden_tube", "Bowden Tube", "extrusion", "Guides filament from the extruder to the hotend.", ["drag", "retraction inconsistency"]),
  component("filament", "Filament Path", "extrusion", "Carries print material through the extrusion system.", ["feed interruption", "tangles"]),
  component("z_stepper", "Z-axis Stepper", "z_axis", "Raises and lowers the gantry in controlled increments.", ["Z banding", "uneven layers"]),
  component("z_leadscrew", "Z Leadscrew", "z_axis", "Converts Z-stepper rotation into vertical travel.", ["Z wobble", "binding"]),
];

const idsFor = (system: SystemId) => bedslingerComponents.filter((item) => item.system === system).map((item) => item.id);

export const bedslingerDevice: Device = {
  id: "generic_cartesian_bedslinger",
  name: "Generic Cartesian Bedslinger",
  category: "fdm_3d_printer",
  systems: [
    { id: "frame", name: "Frame", componentIds: idsFor("frame") },
    { id: "y_axis", name: "Y-axis Motion", componentIds: idsFor("y_axis") },
    { id: "x_axis", name: "X-axis Motion", componentIds: idsFor("x_axis") },
    { id: "toolhead", name: "Toolhead", componentIds: idsFor("toolhead") },
    { id: "extrusion", name: "Extrusion", componentIds: idsFor("extrusion") },
    { id: "z_axis", name: "Z-axis Motion", componentIds: idsFor("z_axis") },
  ],
  components: bedslingerComponents,
};

export const componentById = Object.fromEntries(
  bedslingerComponents.map((item) => [item.id, item]),
) as Record<ComponentId, DeviceComponent>;
