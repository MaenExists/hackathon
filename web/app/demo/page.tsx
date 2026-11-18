import type { Metadata } from "next";
import NewsModelDemo from "../../components/news-model-demo";

export const metadata: Metadata = {
  title: "Corridor | Kerala model demo",
  description:
    "Replay the Kerala district model’s measured results on held-out seizure news reports.",
};

export default function PublicDemo() {
  return (
    <main className="public-model-demo">
      <header>
        <a href="/demo">
          <strong>Corridor</strong>
          <span>Kerala intelligence lab</span>
        </a>
        <a className="public-model-workspace" href="/">
          Analyst workspace
        </a>
      </header>
      <div className="page-heading">
        <div>
          <h1>Kerala district model</h1>
          <p>Replay the measured results of our hackathon prototype.</p>
        </div>
      </div>
      <NewsModelDemo />
    </main>
  );
}
