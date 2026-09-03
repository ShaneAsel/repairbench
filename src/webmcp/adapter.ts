import { componentById } from "../devices/bedslinger/components";
import { useRepairBenchStore } from "../store/repairbench-store";
import { baseTools, dynamicToolsForComponent } from "./tools";
import type { WebMcpTool } from "./types";

class RepairBenchWebMcpAdapter {
  private tools = new Map<string, WebMcpTool>();
  private registrationControllers = new Map<string, AbortController>();
  private unsubscribeStore: (() => void) | null = null;
  private dynamicNames = new Set<string>();
  private selectedComponentId = useRepairBenchStore.getState().viewer.humanSelectedComponentId;

  get mode(): "native" | "preview" {
    return typeof document !== "undefined" && typeof document.modelContext?.registerTool === "function" ? "native" : "preview";
  }

  initialize() {
    for (const tool of baseTools) this.register(tool);
    this.syncDynamicTools(this.selectedComponentId);
    this.unsubscribeStore = useRepairBenchStore.subscribe((state) => {
      const selected = state.viewer.humanSelectedComponentId;
      if (selected === this.selectedComponentId) return;
      this.selectedComponentId = selected;
      this.syncDynamicTools(selected);
    });
    this.publish();
    window.__repairbenchWebMcp = {
      mode: this.mode,
      listTools: () => this.listTools(),
      invoke: (name, input = {}) => this.invoke(name, input),
    };
  }

  destroy() {
    this.unsubscribeStore?.();
    for (const name of [...this.tools.keys()]) this.unregister(name);
    delete window.__repairbenchWebMcp;
  }

  listTools() {
    return [...this.tools.keys()].sort();
  }

  async invoke(name: string, input: unknown) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown RepairBench tool: ${name}`);
    return tool.execute(input);
  }

  private register(tool: WebMcpTool) {
    if (this.tools.has(tool.name)) return;
    this.tools.set(tool.name, tool);
    if (this.mode === "native") {
      const controller = new AbortController();
      this.registrationControllers.set(tool.name, controller);
      void document.modelContext!.registerTool(tool, { signal: controller.signal }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(`Failed to register WebMCP tool ${tool.name}`, error);
      });
    }
  }

  private unregister(name: string) {
    this.registrationControllers.get(name)?.abort();
    this.registrationControllers.delete(name);
    this.tools.delete(name);
  }

  private syncDynamicTools(componentId: typeof this.selectedComponentId) {
    for (const name of this.dynamicNames) this.unregister(name);
    this.dynamicNames.clear();
    const dynamicTools = dynamicToolsForComponent(componentId);
    for (const tool of dynamicTools) {
      this.register(tool);
      this.dynamicNames.add(tool.name);
    }
    this.publish();
    if (componentId && dynamicTools.length > 0) {
      const message = `${componentById[componentId].name} selected — ${dynamicTools.length} context tools available`;
      useRepairBenchStore.getState().recordAgentActivity(message, [componentId]);
    }
  }

  private publish() {
    useRepairBenchStore.getState().setHostState({ mode: this.mode, registeredToolNames: this.listTools() });
  }
}

let singleton: RepairBenchWebMcpAdapter | null = null;

export const initializeWebMcp = () => {
  if (singleton) return singleton;
  singleton = new RepairBenchWebMcpAdapter();
  singleton.initialize();
  return singleton;
};

export const destroyWebMcp = () => {
  singleton?.destroy();
  singleton = null;
};
