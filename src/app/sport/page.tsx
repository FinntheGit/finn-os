"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SportSession = {
  id: string;
  sport_type: "football" | "padel" | "gym" | "running" | "swimming";
  started_at: string;
  duration_minutes: number | null;
  distance_km: number | null;
  avg_heart_rate: number | null;
  perceived_effort: number | null;
  notes: string | null;
};

const SPORT_LABELS: Record<SportSession["sport_type"], string> = {
  football: "Voetbal",
  padel: "Padel",
  gym: "Gym",
  running: "Hardlopen",
  swimming: "Zwemmen",
};

export default function SportPage() {
  const [sessions, setSessions] = useState<SportSession[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadSessions() {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("sport_sessions")
        .select(
          "id, sport_type, started_at, duration_minutes, distance_km, avg_heart_rate, perceived_effort, notes"
        )
        .order("started_at", { ascending: false });

      if (error) {
        setMessage(error.message);
        return;
      }

      setSessions(
        (data ?? []).map((item) => ({
          ...item,
          duration_minutes:
            item.duration_minutes === null ? null : Number(item.duration_minutes),
          distance_km:
            item.distance_km === null ? null : Number(item.distance_km),
          avg_heart_rate:
            item.avg_heart_rate === null ? null : Number(item.avg_heart_rate),
          perceived_effort:
            item.perceived_effort === null
              ? null
              : Number(item.perceived_effort),
        }))
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sportmomenten laden mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function submitSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const form = new FormData(e.currentTarget);

    const sportType = String(
      form.get("sport_type")
    ) as SportSession["sport_type"];

    const startedAt = String(form.get("started_at") || "");
    const durationRaw = String(form.get("duration_minutes") || "").trim();
    const distanceRaw = String(form.get("distance_km") || "").trim();
    const heartRateRaw = String(form.get("avg_heart_rate") || "").trim();
    const effortRaw = String(form.get("perceived_effort") || "").trim();
    const notes = String(form.get("notes") || "").trim();

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

      const { error } = await supabase.from("sport_sessions").insert({
        user_id: user.id,
        sport_type: sportType,
        started_at: new Date(startedAt).toISOString(),
        duration_minutes: durationRaw ? Number(durationRaw) : null,
        distance_km: distanceRaw ? Number(distanceRaw) : null,
        avg_heart_rate: heartRateRaw ? Number(heartRateRaw) : null,
        perceived_effort: effortRaw ? Number(effortRaw) : null,
        notes: notes || null,
      });

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }

      setShowForm(false);
      await loadSessions();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Opslaan mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  const sessionsThisWeek = useMemo(() => {
    const now = new Date();

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    return sessions.filter(
      (session) => new Date(session.started_at) >= startOfWeek
    );
  }, [sessions]);

  const weekCount = sessionsThisWeek.length;
  const weekTarget = 5;
  const progress = Math.min((weekCount / weekTarget) * 100, 100);

  function formatDuration(minutes: number | null) {
    if (!minutes) return null;

    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    if (remaining === 0) return `${hours}u`;

    return `${hours}u ${remaining}m`;
  }

  return (
    <>
      <div className="section-title">
        <div>
          <div className="subtle">Training</div>
          <h1>Sport</h1>
        </div>

        <button className="btn" onClick={() => setShowForm((value) => !value)}>
          {showForm ? "Annuleren" : "+ Sportmoment"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 22 }}>
          <form className="form" onSubmit={submitSession}>
            <div className="field">
              <label>Sport</label>
              <select name="sport_type" defaultValue="gym" required>
                <option value="football">Voetbal</option>
                <option value="padel">Padel</option>
                <option value="gym">Gym</option>
                <option value="running">Hardlopen</option>
                <option value="swimming">Zwemmen</option>
              </select>
            </div>

            <div className="field">
              <label>Datum & tijd</label>
              <input
                name="started_at"
                type="datetime-local"
                required
                defaultValue={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="field">
              <label>Duur in minuten</label>
              <input
                name="duration_minutes"
                type="number"
                min="1"
                max="1440"
                placeholder="Bijv. 90"
              />
            </div>

            <div className="field">
              <label>Afstand in km (optioneel)</label>
              <input
                name="distance_km"
                type="number"
                step="0.01"
                min="0"
                placeholder="Bijv. 5.4"
              />
            </div>

            <div className="field">
              <label>Gem. hartslag (optioneel)</label>
              <input
                name="avg_heart_rate"
                type="number"
                min="30"
                max="240"
                placeholder="Bijv. 154"
              />
            </div>

            <div className="field">
              <label>Inspanning 1-10 (optioneel)</label>
              <input
                name="perceived_effort"
                type="number"
                min="1"
                max="10"
                placeholder="Bijv. 7"
              />
            </div>

            <div className="field">
              <label>Notitie (optioneel)</label>
              <textarea
                name="notes"
                placeholder="Bijv. zware training, benen voelden goed"
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
          <div className="metric">
            <div>
              <div className="subtle">Deze week</div>
              <div className="big" style={{ fontSize: "3rem" }}>
                {loading ? "..." : `${weekCount}/${weekTarget}`}
              </div>
            </div>

            <span className="pill">weekscore</span>
          </div>

          <div className="progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="subtle">Structureel</div>

          <div className="list">
            <div className="row">
              <span>Woensdag · Voetbaltraining</span>
              <strong>1,5u</strong>
            </div>

            <div className="row">
              <span>Vrijdag · Padel</span>
              <strong>2u</strong>
            </div>

            <div className="row">
              <span>Zaterdag · Wedstrijd</span>
              <strong>1,5u</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="section-title">
        <h2>Logboek</h2>
      </div>

      <div className="card">
        {sessions.length === 0 ? (
          <>
            <p className="subtle">
              Nog geen sportmomenten geregistreerd.
            </p>

            <div className="notice">
              Gym krijgt later sets/reps/gewicht en automatische
              PR-herkenning. Hardlopen krijgt daarna tempo-analyse.
            </div>
          </>
        ) : (
          <div className="list">
            {sessions.slice(0, 12).map((session) => (
              <div className="row" key={session.id}>
                <span>
                  <strong>{SPORT_LABELS[session.sport_type]}</strong>
                  <br />
                  <span className="subtle">
                    {new Date(session.started_at).toLocaleDateString("nl-NL")}
                  </span>
                </span>

                <span style={{ textAlign: "right" }}>
                  <strong>
                    {formatDuration(session.duration_minutes) ?? "—"}
                  </strong>

                  {session.distance_km !== null && (
                    <>
                      <br />
                      <span className="subtle">
                        {session.distance_km.toFixed(2)} km
                      </span>
                    </>
                  )}

                  {session.perceived_effort !== null && (
                    <>
                      <br />
                      <span className="subtle">
                        RPE {session.perceived_effort}/10
                      </span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
