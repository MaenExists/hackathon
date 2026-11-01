import TipForm from "../../components/tip-form";
import { Network } from "lucide-react";
export default function Report() {
  return (
    <main className="intake-page">
      <a href="/" className="brand">
        <Network size={29} />
        <span>
          corridor
          <span className="brand-sub">Independent research prototype</span>
        </span>
      </a>
      <section>
        <span className="demo-pill">Fictional demonstration</span>
        <h1>A private place to start.</h1>
        <p>Explore how a community lead moves into careful human review.</p>
        <TipForm />
      </section>
      <footer>
        No report is forwarded to any authority. The hosted private gate
        requires sign-in.
      </footer>
    </main>
  );
}
