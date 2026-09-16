"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Measurement = {
  id: string;
  measured_on: string;
  weight_kg: number;
};

export default function DashboardPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, measured_on, weight_kg")
        .order("measured_on", { ascending: false });

      if (!error) {
        setMeasurements(
          (data ?? []).map((item) => ({
            ...item,
            weight_kg: Number(item.weight_kg),
          }))
        );
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  const currentWeight = measurements[0]?.weight_kg ?? null;

  const measuredThisWeek = useMemo(() => {
    if (measurements.length === 0) return false;

    const now = new Date();

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    return measurements.some((item) => {
      const date = new Date(item.measured_on);
      return date >= startOfWeek;
    });
  }, [measurements]);

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
          <div className="subtle">Vandaag</div>
          <h1>Jouw overzicht</h1>
        </div>

        <Link className="btn" href="/dashboard/check-in">
          + Check-in
        </Link>
      </div>

      <section className="hero">
        <div className="card">
          <div className="subtle">Life Score</div>

          <div className="big">
            —
            <span style={{ fontSize: "1.2rem", fontWeight: 600 }}>
              /100
            </span>
          </div>

          <p className="subtle">
            Wordt berekend zodra er genoeg gegevens zijn.
          </p>

          <div className="progress">
            <span style={{ width: "0%" }} />
          </div>
        </div>

        <div className="card">
          <div className="subtle">Weekfocus</div>
          <h2>3 doelen</h2>

          <div className="list">
            <div className="row">
              <span>Sportmomenten halen</span>
              <strong>0/5</strong>
            </div>

            <div className="row">
              <span>Gewicht meten</span>
              <strong>{measuredThisWeek ? "✓" : "○"}</strong>
            </div>

            <div className="row">
              <span>Weekbudget volgen</span>
              <strong>○</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="grid">
        <Link href="/sport" className="card">
          <div className="metric">
            <div>
              <div className="subtle">Sport</div>
              <div className="metric-value">0 / 5</div>
            </div>

            <span className="pill">⚽ week</span>
          </div>

          <p className="subtle">
            Voetbal, padel, gym, hardlopen en zwemmen.
          </p>
        </Link>

        <Link href="/gewicht" className="card">
          <div className="metric">
            <div>
              <div className="subtle">Gewicht</div>

              <div className="metric-value">
                {loading
                  ? "..."
                  : currentWeight !== null
                    ? `${currentWeight.toFixed(1)} kg`
                    : "— kg"}
              </div>
            </div>

            <span className="pill">⚖ wekelijks</span>
          </div>

          <p className="subtle">
            {fourWeekTrend === null
              ? "4-weken-trend en voortgang richting je doel."
              : `4-weken-trend: ${
                  fourWeekTrend > 0 ? "+" : ""
                }${fourWeekTrend.toFixed(1)} kg`}
          </p>
        </Link>

        <Link href="/geld" className="card">
          <div className="metric">
            <div>
              <div className="subtle">Safe to spend</div>
              <div className="metric-value">€ —</div>
            </div>

            <span className="pill">🔒 Money Lock</span>
          </div>

          <p className="subtle">
            Budgetten, spaardoelen en uitgavenpatronen.
          </p>
        </Link>
      </section>

      <div className="section-title">
        <h2>Vandaag</h2>
      </div>

      <section className="grid two">
        <div className="card">
          <div className="subtle">Water & alcohol</div>

          <div className="list">
            <div className="row">
              <span>💧 Water</span>
              <strong>— L</strong>
            </div>

            <div className="row">
              <span>🍺 Alcohol</span>
              <strong>—</strong>
            </div>
          </div>
        </div>

        <Link href="/agenda" className="card">
          <div className="subtle">Agenda</div>
          <h3>Nog niet gekoppeld</h3>
          <p className="subtle">
            In v1 tonen we eigen afspraken; iCloud/werkagenda volgt daarna.
          </p>
        </Link>
      </section>
    </>
  );
}
