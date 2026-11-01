"use client";
import { useState } from "react";
import { places } from "../data/geography";
import { ShieldCheck, Check, ArrowRight } from "lucide-react";
export default function TipForm({ onSaved }: { onSaved?: () => void }) {
  const [district, setDistrict] = useState("ernakulam"),
    [narrative, setNarrative] = useState(""),
    [contact, setContact] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  if (receipt)
    return (
      <div className="modal-body receipt">
        <Check size={40} />
        <h2>Saved for private review.</h2>
        <p>
          Your fictional exercise is unreviewed. No report has been sent to any
          authority, and it will never enter a forecast.
        </p>
        <code>{receipt}</code>
        <button
          className="primary"
          onClick={() => {
            setReceipt("");
            setNarrative("");
          }}
        >
          Try another exercise
        </button>
      </div>
    );
  return (
    <form
      className="modal-body tip-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const r = await fetch("/api/tips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              district,
              narrative,
              contact,
              synthetic: true,
            }),
          });
          const j = (await r.json()) as { error?: string; id: string };
          if (!r.ok) throw Error(j.error);
          setReceipt(j.id);
          onSaved?.();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="inspector-note">
        <ShieldCheck size={19} />
        <p>
          Fictional exercise only. Private review, optional contact, no account
          needed for local intake. Hosting logs may exist; anonymity is not
          guaranteed.
        </p>
      </div>
      <label>
        District
        <select value={district} onChange={(e) => setDistrict(e.target.value)}>
          {places
            .filter((p) => p.state === "Kerala")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Fictional observation
        <textarea
          required
          minLength={30}
          maxLength={3000}
          rows={5}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          placeholder="Describe a fictional observation, timing and uncertainty. Do not identify real people, homes, schools or businesses."
        />
      </label>
      <label>
        Contact <span className="muted">Optional · use fictional details</span>
        <input
          value={contact}
          maxLength={200}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Leave blank to omit contact details"
        />
      </label>
      <label className="check-label">
        <input
          required
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        This is fictional and contains no personal information or real
        allegations.
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy || !consent}>
        {busy ? "Saving…" : "Save fictional lead"}
        <ArrowRight size={15} />
      </button>
      <p className="fineprint">
        For actual reporting, consult{" "}
        <a
          href="https://ps.keralapolice.gov.in/kothamangalam-ps/notifications/Yodhav--War-against-Narcotics-3332"
          target="_blank"
          rel="noreferrer"
        >
          Kerala Police’s Yodhav channel
        </a>
        . This independent prototype has no reporting connection.
      </p>
    </form>
  );
}
