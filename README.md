# RepairBench

RepairBench is an AI-assisted troubleshooting workspace for physical devices. The challenge MVP models a generic Cartesian FDM printer and fully implements a deterministic Y-axis movement diagnostic.

> The AI reasons. RepairBench visualizes. The human observes and acts.

## Run locally

```bash
bun install
bun run dev
```

Production checks:

```bash
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

Open `/demo/y-axis?reset=1` for a clean challenge scenario. Normal visits to `/demo/y-axis` resume the compatible persisted session; the header also contains **Reset demo**.

## Challenge architecture

RepairBench is a client-only Vite application. Zustand owns the versioned diagnostic state, React Three Fiber renders a printer from semantically grouped primitives, and the WebMCP layer translates semantic agent commands into the same store actions used by the UI.

The app intentionally has no embedded chat or proprietary agent backend. Conversation belongs to the external WebMCP-capable host; RepairBench is the shared visual workspace.

```text
External agent host
        │ semantic tools
        ▼
WebMcpAdapter ──────► diagnostic commands ──────► Zustand store
        │                                             │
        └── dynamic tool registration                 ├── diagnostic panels
            from human selection                      ├── event timeline
                                                      └── semantic 3D viewer
```

The adapter uses the official imperative API, `document.modelContext.registerTool`, when that native API is present. Registrations receive an `AbortSignal` so component-specific tools are cleanly unregistered when human selection changes. When the API is absent, the identical contracts run through an in-memory preview adapter exposed at `window.__repairbenchWebMcp`; this exists for contract tests and local integration work, not as a fake challenge demonstration.

For local native testing, use Google Chrome 149 or later, enable `chrome://flags/#enable-webmcp-testing`, and relaunch Chrome. The challenge also supports ChatGPT's in-app browser without additional configuration. Production hosts must preserve the included origin-isolation and `tools` permissions-policy headers.

## Canonical three-minute demo

1. Open `/demo/y-axis?reset=1` in the challenge browser and connect the external agent host.
2. Ask: “My bed moves backward fine, but moving forward sometimes causes grinding and layer shifting. Help me diagnose it.”
3. The agent calls `get_active_diagnostic`, highlights the Y-axis components, creates `manual_y_motion`, and calls `request_observation`.
4. ChatGPT asks the returned safe question. Reply in chat: **Moves freely**.
5. The agent calls `record_test_result`, RepairBench visibly records the response as `human_chat`, and the tool returns an evidence reference plus suggested effects.
6. The agent calls `update_hypothesis`, marking `physical_obstruction` unlikely with that observation as evidence.
7. Ask: “What parts are only involved once the machine is powered?” The agent shows the `y_powertrain` motion path.
8. Click the drive pulley. RepairBench visibly registers `show_pulley_motion` and `request_pulley_condition`.
9. Ask: “Could this part cause the layer shifts?” The agent uses the human-selected component context and shows the pulley failure path.

## Safety and provenance

- Agent-created tests are restricted to local, reviewed templates.
- Manual bed movement explicitly requires the printer to be powered off.
- Powered observations instruct the user to keep hands clear and be ready to stop motion.
- `request_observation` returns reviewed instructions and allowed answers for ChatGPT to ask in conversation; `record_test_result` accepts only a matching result for an active request.
- Chat replies are recorded as `human_chat`; optional in-page choices are recorded separately as `human_ui`.
- Human selection is blue. Agent focus and emphasis are amber and never unlock context tools.

## Tool surface

Base tools include diagnostic reads, semantic component focus/highlighting, predefined motion explanations, safe test creation, observation requests, and evidence-backed hypothesis updates. Human selection dynamically adds belt, pulley, or endstop tools and removes the previous context tools when selection changes.

Non-Y-axis categories are clearly marked seeded previews in v0.1. They demonstrate the future device-pack direction without claiming a complete diagnostic workflow.

## License

RepairBench is available under the [MIT License](LICENSE).
