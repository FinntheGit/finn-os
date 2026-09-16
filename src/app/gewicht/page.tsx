"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Measurement = {
  id: string;
  measured_on: string;
  weight_kg: number;
  body_fat_pct: number | null;
};

export default function GewichtPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadMeasurements() {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, measured_on, weight_kg, body_fat_pct")
        .order("measured_on", { ascending: false });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMeasurements(
        (data ?? []).map((item) => ({
          ...item,
          weight_kg: Number(item.weight_kg),
          body_fat_pct:
            item.body_fat_pct === null ? null : Number(item.body_fat_pct),
        }))
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Metingen laden mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMeasurements();
  }, []);

  async function submitMeasurement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const form = new FormData(e.currentTarget);
    const measuredOn = String(form.get("measured_on") || "");
    const weightKg = Number(form.get("weight_kg"));
    const bodyFatRaw = String(form.get("body_fat_pct") || "").trim();
    const bodyFatPct = bodyFatRaw ? Number(bodyFatRaw) : null;

    if (!measuredOn || !weightKg) {
      setMessage("Vul minimaal een datum en gewicht in.");
      setSaving(false);
      return;
    }

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Je bent niet ingelogd.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("body_measurements").upsert(
        {
          user_id: user.id,
          measured_on: measuredOn,
          weight_kg: weightKg,
          body_fat_pct: bodyFatPct,
        },
        {
          onConflict: "user_id,measured_on",
        }
      );

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }

      setShowForm(false);
      await loadMeasurements();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Opslaan mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  const currentWeight = measurements[0]?.weight_kg ?? null;

  const fourWeekTrend = useMemo(() => {
    if (measurements.length < 2) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);

    const recent = measurements
      .filter((item) => new Date(item.measured_on) >= cutoff)
      .sort(
        (a, b) =>
          new Date(a.measured_on).getTime() -
          new Date(b.measured_on).getTime()
      );

    if (recent.length < 2) return null;

    return recent[recent.length - 1].weight_kg - recent[0].weight_kg;
  }, [measurements]);

  return (
    <>
      <div className="section-title">
        <div>
          <div className="subtle">Wekelijkse meting</div>
          <h1>Gewicht</h1>
        </div>

        <button className="btn" onClick={() => setShowForm((value) => !value)}>
          {showForm ? "Annuleren" : "+ Meting"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 22 }}>
          <form className="form" onSubmit={submitMeasurement}>
            <div className="field">
              <label>Datum</label>
              <input
                name="measured_on"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <div className="field">
              <label>Gewicht (kg)</label>
              <input
                name="weight_kg"
                type="number"
                step="0.1"
                min="40"
                max="250"
                required
                placeholder="Bijv. 89.4"
              />
            </div>

            <div className="field">
              <label>Lichaamsvet % (optioneel)</label>
              <input
                name="body_fat_pct"
                type="number"
                step="0.1"
                min="1"
                max="70"
                placeholder="Bijv. 14.8"
              />
            </div>

            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </form>
        </div>
      )}

      {message && (
        <div className="notice" style={{ marginBottom: 22 }}>
          {message}
        </div>
      )}

      <section className="grid two">
        <div className="card">
          <div className="subtle">Huidig</div>
          <div className="big" style={{ fontSize: "3.2rem" }}>
            {loading
              ? "..."
              : currentWeight !== null
                ? `${currentWeight.toFixed(1)} kg`
                : "— kg"}
          </div>

          <p className="subtle">
            {currentWeight !== null
              ? `Laatste meting: ${new Date(
                  measurements[0].measured_on
                ).toLocaleDateString("nl-NL")}`
              : "Vul je nieuwe meting in zodra je gewogen hebt."}
          </p>
        </div>

        <div className="card">
          <div className="subtle">4-weken-trend</div>
          <div className="big" style={{ fontSize: "3.2rem" }}>
            {fourWeekTrend === null
              ? "—"
              : `${fourWeekTrend > 0 ? "+" : ""}${fourWeekTrend.toFixed(
                  1
                )} kg`}
          </div>

          <p className="subtle">
            Verschil tussen je eerste en laatste meting van de afgelopen 4
            weken.
          </p>
        </div>
      </section>

      <div className="section-title">
        <h2>Ontwikkeling</h2>
      </div>

      <div className="card">
        {measurements.length === 0 ? (
          <div className="notice">
            Nog geen metingen. Voeg je eerste gewicht toe.
          </div>
        ) : (
          <div className="list">
            {measurements.slice(0, 8).map((item) => (
              <div className="row" key={item.id}>
                <span>
                  {new Date(item.measured_on).toLocaleDateString("nl-NL")}
                </span>
                <strong>
                  {item.weight_kg.toFixed(1)} kg
                  {item.body_fat_pct !== null
                    ? ` · ${item.body_fat_pct.toFixed(1)}%`
                    : ""}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
