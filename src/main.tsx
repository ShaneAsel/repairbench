import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { ArrowRight, Box, ChevronRight, LockKeyhole, Settings2, Sparkles, Wrench } from "lucide-react";
import { DiagnosticWorkspace } from "./components/diagnostic/DiagnosticWorkspace";
import { destroyWebMcp, initializeWebMcp } from "./webmcp/adapter";
import { useRepairBenchStore } from "./store/repairbench-store";
import "./styles.css";

function AppRoot() {
  useEffect(() => {
    initializeWebMcp();
    return () => destroyWebMcp();
  }, []);

  return <Outlet />;
}

const rootRoute = createRootRoute({ component: AppRoot });

const categoryOptions = [
  { id: "movement", label: "Movement / Layer Shifting", description: "Grinding, binding, or shifted print layers", available: true },
  { id: "extrusion", label: "Extrusion", description: "No filament, slipping, or nozzle clogs", available: false },
  { id: "first_layer", label: "First Layer", description: "Adhesion and nozzle-height problems", available: false },
  { id: "stringing", label: "Stringing", description: "Excess filament between travel moves", available: false },
  { id: "fused_parts", label: "Fused Moving Parts", description: "Articulated joints printed together", available: false },
];

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className={`brand ${dark ? "brand-dark" : ""}`} aria-label="RepairBench home">
      <span className="brand-mark"><Wrench size={16} strokeWidth={2.4} /></span>
      <span>RepairBench</span>
    </Link>
  );
}

function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <Brand />
        <Link to="/diagnostic/new" className="button button-dark button-small">Start diagnosis <ArrowRight size={15} /></Link>
      </header>

      <section className="hero">
        <div className="eyebrow"><Sparkles size={14} /> A shared workbench for human and AI</div>
        <h1>Find the fault.<br /><span>See the reasoning.</span></h1>
        <p>RepairBench turns physical troubleshooting into a live, visual workspace where AI reasons, you observe, and every diagnostic step stays grounded.</p>
        <div className="hero-actions">
          <Link to="/demo/y-axis" search={{ reset: "1" }} className="button button-primary">Open Y-axis demo <ArrowRight size={17} /></Link>
          <Link to="/diagnostic/new" className="button button-secondary">Diagnose a problem</Link>
        </div>
        <div className="hero-proof">
          <span><span className="proof-dot" /> No account required</span>
          <span>Runs locally in your browser</span>
          <span>Structured human observations</span>
        </div>
      </section>

      <section className="device-section">
        <div className="section-heading">
          <div><span className="section-kicker">Device library</span><h2>Choose your workbench</h2></div>
          <span className="section-note">One deeply modeled device for the challenge MVP</span>
        </div>
        <Link to="/diagnostic/new" className="device-card">
          <div className="device-illustration" aria-hidden="true">
            <div className="mini-printer"><span className="mini-gantry" /><span className="mini-rail" /><span className="mini-head" /><span className="mini-bed" /></div>
          </div>
          <div className="device-card-copy">
            <div className="available-label"><span /> Available now</div>
            <h3>FDM 3D Printer</h3>
            <p>Generic Cartesian bedslinger with semantic Y-axis, extrusion, toolhead, and frame systems.</p>
            <div className="component-chips"><span>22 components</span><span>5 symptom categories</span><span>Interactive 3D</span></div>
          </div>
          <ChevronRight size={22} className="card-chevron" />
        </Link>
        <div className="coming-grid">
          {["Appliance", "Electronics", "Vehicle", "Power Tool"].map((label) => (
            <div className="coming-card" key={label}><LockKeyhole size={15} /><span>{label}</span><small>Coming soon</small></div>
          ))}
        </div>
      </section>

      <footer className="landing-footer"><Brand /><p>Give AI a pair of hands.</p></footer>
    </main>
  );
}

function NewDiagnosticPage() {
  const navigate = useNavigate();
  const startSession = useRepairBenchStore((state) => state.startSession);
  const [category, setCategory] = React.useState("movement");
  const [complaint, setComplaint] = React.useState("");
  const selected = categoryOptions.find((item) => item.id === category)!;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = complaint.trim();
    if (!text) return;
    const id = startSession({ category, categoryLabel: selected.label, complaint: text });
    void navigate({ to: "/diagnostic/$id", params: { id } });
  };

  return (
    <main className="intake-shell">
      <header className="landing-nav"><Brand /><Link to="/" className="text-link">Back to devices</Link></header>
      <form className="intake-card" onSubmit={submit}>
        <div className="step-label">New diagnostic</div>
        <h1>What is the printer doing?</h1>
        <p>Select the closest system, then describe what you can see, hear, or feel.</p>
        <div className="category-list" role="radiogroup" aria-label="Problem category">
          {categoryOptions.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`category-option ${category === item.id ? "selected" : ""}`}
              onClick={() => setCategory(item.id)}
              role="radio"
              aria-checked={category === item.id}
            >
              <span className="category-icon">{item.id === "movement" ? <Settings2 size={19} /> : <Box size={19} />}</span>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              {!item.available && <em>Preview</em>}
            </button>
          ))}
        </div>
        <label className="complaint-field">
          <span>Describe the problem</span>
          <textarea
            value={complaint}
            onChange={(event) => setComplaint(event.target.value)}
            placeholder="For example: The bed moves backward normally, but grinds when it comes forward…"
            rows={4}
            maxLength={800}
            required
          />
          <small>{complaint.length} / 800</small>
        </label>
        {!selected.available && <div className="preview-notice">This category opens a seeded product preview. The Y-axis movement workflow is the fully interactive challenge scenario.</div>}
        <button className="button button-primary button-wide" type="submit" disabled={!complaint.trim()}>Start diagnosis <ArrowRight size={17} /></button>
      </form>
    </main>
  );
}

function DemoPage() {
  const resetDemo = useRepairBenchStore((state) => state.resetDemo);
  const ensureCompatibleDemo = useRepairBenchStore((state) => state.ensureCompatibleDemo);
  const { reset } = useSearch({ from: "/demo/y-axis" });
  const navigate = useNavigate({ from: "/demo/y-axis" });

  useEffect(() => {
    if (reset === "1") {
      resetDemo();
      void navigate({ search: {}, replace: true });
    } else {
      ensureCompatibleDemo();
    }
  }, [ensureCompatibleDemo, navigate, reset, resetDemo]);

  return <DiagnosticWorkspace />;
}

function DiagnosticPage() {
  return <DiagnosticWorkspace />;
}

const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: LandingPage });
const newRoute = createRoute({ getParentRoute: () => rootRoute, path: "/diagnostic/new", component: NewDiagnosticPage });
const diagnosticRoute = createRoute({ getParentRoute: () => rootRoute, path: "/diagnostic/$id", component: DiagnosticPage });
const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/demo/y-axis",
  validateSearch: (search: Record<string, unknown>): { reset?: "1" } => ({
    reset: search.reset === "1" || search.reset === 1 || search.reset === true ? "1" : undefined,
  }),
  component: DemoPage,
});
const routeTree = rootRoute.addChildren([landingRoute, newRoute, diagnosticRoute, demoRoute]);
const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

import React from "react";

createRoot(document.getElementById("root")!).render(
  <StrictMode><RouterProvider router={router} /></StrictMode>,
);
