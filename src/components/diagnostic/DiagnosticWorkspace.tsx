import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Eye,
  History,
  Info,
  ListChecks,
  MousePointer2,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { bedslingerDevice, componentById } from "../../devices/bedslinger/components";
import { useRepairBenchStore } from "../../store/repairbench-store";
import type { Hypothesis, HypothesisStatus } from "../../domain/types";

const PrinterViewer = lazy(() => import("../viewer/PrinterViewer").then((module) => ({ default: module.PrinterViewer })));

const statusOrder: Record<HypothesisStatus, number> = { confirmed: 0, likely: 1, possible: 2, unlikely: 3, eliminated: 4 };

function Logo() {
  return <Link to="/" className="workspace-brand"><span><Wrench size={14} /></span>RepairBench</Link>;
}

function HostBadge() {
  const host = useRepairBenchStore((state) => state.host);
  const [open, setOpen] = useState(false);
  const native = host.mode === "native";
  return (
    <div className="host-control">
      <button className={`host-badge ${native ? "native" : "preview"}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="host-pulse" />
        {native ? "WebMCP connected" : "WebMCP preview"}
        <b>{host.registeredToolNames.length} tools</b>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="tool-popover">
          <div className="popover-title"><span>Registered semantic tools</span><button onClick={() => setOpen(false)} aria-label="Close"><X size={14} /></button></div>
          {!native && <p>Your browser does not expose the native WebMCP API. The same contracts are active in the local preview adapter.</p>}
          <div className="tool-name-grid">{host.registeredToolNames.map((name) => <code key={name}>{name}</code>)}</div>
        </div>
      )}
    </div>
  );
}

function WorkspaceHeader() {
  const session = useRepairBenchStore((state) => state.session);
  const resetDemo = useRepairBenchStore((state) => state.resetDemo);
  return (
    <header className="workspace-header">
      <Logo />
      <div className="diagnostic-meta"><span>{session.id}</span><i /><strong>{session.categoryLabel}</strong></div>
      <div className="header-device"><span>DEVICE</span><strong>{bedslingerDevice.name}</strong></div>
      <HostBadge />
      {session.mode === "demo" && <button className="reset-demo" onClick={resetDemo}><RotateCcw size={14} /> Reset demo</button>}
    </header>
  );
}

function SectionTitle({ icon, children, count }: { icon: React.ReactNode; children: React.ReactNode; count?: number }) {
  return <div className="panel-section-title"><span>{icon}{children}</span>{typeof count === "number" && <b>{count}</b>}</div>;
}

function LeftPanel() {
  const session = useRepairBenchStore((state) => state.session);
  const events = [...session.timeline].reverse().slice(0, 8);
  return (
    <aside className="left-panel workspace-panel">
      <div className="panel-heading"><span>Diagnostic</span><small>Revision {session.revision}</small></div>
      <section className="panel-section complaint-section">
        <SectionTitle icon={<Info size={14} />}>Complaint</SectionTitle>
        <blockquote>{session.complaint}</blockquote>
      </section>
      <section className="panel-section">
        <SectionTitle icon={<ListChecks size={14} />} count={session.tests.length}>Tests</SectionTitle>
        {session.tests.length === 0 ? (
          <div className="empty-panel"><Circle size={16} /><span>No tests yet</span><small>The agent can create a grounded diagnostic test.</small></div>
        ) : (
          <div className="test-list">
            {session.tests.map((test) => {
              const result = test.resultOptions.find((item) => item.id === test.resultOptionId);
              return (
                <div className={`test-row ${test.status}`} key={test.id}>
                  <span className="test-status-icon">{test.status === "completed" ? <Check size={13} /> : test.status === "active" ? <span className="active-ring" /> : <Clock3 size={13} />}</span>
                  <div><strong>{test.title}</strong><small>{test.status === "completed" && result ? result.label : test.status === "active" ? "Waiting for observation" : "Pending"}</small></div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section className="panel-section">
        <SectionTitle icon={<Eye size={14} />} count={session.observations.length}>Observations</SectionTitle>
        {session.observations.length === 0 ? (
          <p className="quiet-copy">Physical results you submit will appear here as structured evidence.</p>
        ) : (
          <div className="observation-list">
            {session.observations.map((observation) => {
              const test = session.tests.find((item) => item.id === observation.testId);
              const source = observation.source === "human_chat" ? "via ChatGPT" : "in RepairBench";
              return <div className="observation-row" key={observation.id}><CheckCircle2 size={15} /><span><small>{test?.title} · {source}</small><strong>{observation.label}</strong></span></div>;
            })}
          </div>
        )}
      </section>
      <section className="panel-section timeline-section">
        <SectionTitle icon={<History size={14} />}>Timeline</SectionTitle>
        <div className="timeline-list">
          {events.map((item) => <div className="timeline-row" key={item.id}><span className={`timeline-dot ${item.source}`} /><div><p>{item.message}</p><time>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div></div>)}
        </div>
      </section>
    </aside>
  );
}

function HypothesisRow({ hypothesis }: { hypothesis: Hypothesis }) {
  const setHighlights = useRepairBenchStore((state) => state.setAgentHighlights);
  return (
    <button className="hypothesis-row" onClick={() => setHighlights(hypothesis.componentIds)}>
      <span className={`status-marker ${hypothesis.status}`} />
      <span className="hypothesis-copy"><span className={`status-label ${hypothesis.status}`}>{hypothesis.status}</span><strong>{hypothesis.title}</strong><small>{hypothesis.reasoning}</small></span>
    </button>
  );
}

function RightPanel() {
  const session = useRepairBenchStore((state) => state.session);
  const selectedId = useRepairBenchStore((state) => state.viewer.humanSelectedComponentId);
  const setSelection = useRepairBenchStore((state) => state.setHumanSelection);
  const selected = selectedId ? componentById[selectedId] : null;
  const hypotheses = useMemo(() => [...session.hypotheses].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]), [session.hypotheses]);
  const contextToolCount = selectedId === "y_belt" ? 3 : selectedId === "y_drive_pulley" || selectedId === "y_endstop" ? 2 : 0;

  return (
    <aside className="right-panel workspace-panel">
      <div className="panel-heading"><span>Reasoning</span><small>{hypotheses.length} hypotheses</small></div>
      <section className="panel-section hypotheses-section">
        <SectionTitle icon={<Sparkles size={14} />}>Hypotheses</SectionTitle>
        <div className="hypotheses-list">{hypotheses.map((hypothesis) => <HypothesisRow key={hypothesis.id} hypothesis={hypothesis} />)}</div>
      </section>
      <section className="component-section">
        <div className="component-section-heading"><span>Component details</span>{selected && <button onClick={() => setSelection(null)} aria-label="Clear selection"><X size={14} /></button>}</div>
        {selected ? (
          <div className="component-detail">
            <div className="component-icon"><MousePointer2 size={18} /></div>
            <span className="component-system">{bedslingerDevice.systems.find((item) => item.id === selected.system)?.name}</span>
            <h3>{selected.name}</h3>
            <p>{selected.purpose}</p>
            {contextToolCount > 0 && <div className="context-tools-callout"><Bot size={15} /><span><strong>{contextToolCount} context tools unlocked</strong><small>Available because you selected this component</small></span></div>}
            <dl>
              <div><dt>Related symptoms</dt><dd>{selected.relatedSymptoms.map((symptom) => <span key={symptom}>{symptom}</span>)}</dd></div>
              <div><dt>Relevant tests</dt><dd>{selected.relevantTests.length ? selected.relevantTests.map((test) => <span key={test}>{test.replaceAll("_", " ")}</span>) : <span>General inspection</span>}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="component-empty"><MousePointer2 size={22} /><strong>Select a component</strong><p>Click the model to inspect its purpose, symptoms, and contextual agent tools.</p></div>
        )}
      </section>
    </aside>
  );
}

function ObservationBar() {
  const session = useRepairBenchStore((state) => state.session);
  const submitObservation = useRepairBenchStore((state) => state.submitObservation);
  const request = session.observationRequests.find((item) => item.status === "awaiting_human");
  if (!request) return <ActivityBar />;
  const test = session.tests.find((item) => item.id === request.testId);
  if (!test) return <ActivityBar />;
  return (
    <div className="observation-bar">
      <div className="observation-prompt-icon"><Eye size={19} /></div>
      <div className="observation-prompt"><span>Reply in ChatGPT or record here</span><strong>{request.prompt}</strong><small>{request.question}</small></div>
      <div className="observation-actions">
        {test.resultOptions.filter((option) => request.optionIds.includes(option.id)).map((option) => (
          <button key={option.id} onClick={() => submitObservation(request.id, option.id)}>{option.label}</button>
        ))}
      </div>
      <div className="safety-note"><AlertTriangle size={13} /> Follow the power-state instruction before touching the printer.</div>
    </div>
  );
}

function ActivityBar() {
  const activity = useRepairBenchStore((state) => state.activity);
  const latest = activity[0];
  return (
    <div className="activity-bar">
      <div className="activity-title"><span className="agent-orb"><Bot size={14} /></span><span><strong>Agent activity</strong><small>Semantic actions appear here</small></span></div>
      <div className="latest-activity">{latest ? <><span className="live-dot" /><p>{latest.message}</p><em>via WebMCP</em></> : <><Activity size={15} /><p>Waiting for the agent to inspect this diagnostic</p></>}</div>
      <div className="activity-source"><span>Human selection</span><i /> <span>Agent emphasis</span></div>
    </div>
  );
}

export function DiagnosticWorkspace() {
  const session = useRepairBenchStore((state) => state.session);
  return (
    <main className="workspace-shell">
      <WorkspaceHeader />
      {session.mode === "preview" && <div className="preview-banner"><Info size={14} /><strong>Preview workflow</strong><span>This category contains seeded product content. The complete challenge flow is available in the Y-axis demo.</span><Link to="/demo/y-axis" search={{ reset: "1" }}>Open demo</Link></div>}
      <div className="workspace-grid">
        <LeftPanel />
        <section className="center-panel">
          <Suspense fallback={<div className="viewer-loading"><span /><strong>Preparing semantic device model</strong></div>}>
            <PrinterViewer />
          </Suspense>
        </section>
        <RightPanel />
      </div>
      <ObservationBar />
    </main>
  );
}
