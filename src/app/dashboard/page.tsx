"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Measurement = {
  id: string;
  measured_on: string;
  weight_kg: number;
};

type SportSession = {
  id: string;
  started_at: string;
};

type DailyCheckin = {
  checkin_date: string;
  water_liters: number | null;
  alcohol_drinks: number | null;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [sportSessions, setSportSessions] = useState<SportSession[]>([]);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      const [
        { data: measurementData },
        { data: sportData },
        { data: checkinData },
      ] = await Promise.all([
        supabase
          .from("body_measurements")
          .select("id, measured_on, weight_kg")
          .order("measured_on", { ascending: false }),

        supabase
          .from("sport_sessions")
          .select("id, started_at")
          .order("started_at", { ascending: false }),

        supabase
          .from("daily_checkins")
          .select("checkin_date, water_liters, alcohol_drinks")
          .order("checkin_date", { ascending: false })
          .limit(60),
      ]);

      setMeasurements(
        (measurementData ?? []).map((item) => ({
          ...item,
          weight_kg: Number(item.weight_kg),
        }))
      );

      setSportSessions(sportData ?? []);

      setCheckins(
        (checkinData ?? []).map((item) => ({
          ...item,
          water_liters:
            item.water_liters === null ? null : Number(item.water_liters),
          alcohol_drinks:
            item.alcohol_drinks === null
              ? null
              : Number(item.alcohol_drinks),
        }))
      );

      setLoading(false);
    }

    loadDashboard();
  }, []);

  const todayKey = localDateKey(new Date());

  const todayCheckin =
    checkins.find((item) => item.checkin_date === todayKey) ?? null;

  const currentWeight = measurements[0]?.weight_kg ?? null;

  const startOfWeek = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);

    const day = monday.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    monday.setDate(monday.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    return monday;
  }, []);

  const measuredThisWeek = useMemo(() => {
    return measurements.some(
      (item) => new Date(`${item.measured_on}T12:00:00`) >= startOfWeek
    );
  }, [measurements, startOfWeek]);

  const sportThisWeek = useMemo(() => {
    return sportSessions.filter(
      (session) => new Date(session.started_at) >= startOfWeek
    ).length;
  }, [sportSessions, startOfWeek]);

  const sportTarget = 5;

  const fourWeekTrend = useMemo(() => {
    if (measurements.length < 2) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);

    const recent = measurements
      .filter(
        (item) => new Date(`${item.measured_on}T12:00:00`) >= cutoff
      )
      .sort(
        (a, b) =>
          new Date(`${a.measured_on}T12:00:00`).getTime() -
          new Date(`${b.measured_on}T12:00:00`).getTime()
      );

    if (recent.length < 2) return null;

    return recent[recent.length - 1].weight_kg - recent[0].weight_kg;
  }, [measurements]);

  const checkinStreak = useMemo(() => {
    if (checkins.length === 0) return 0;

    const dates = new Set(checkins.map((item) => item.checkin_date));

    let cursor = new Date();
    let streak = 0;

    // Als je vandaag nog niet hebt ingecheckt, blijft de streak
    // gedurende vandaag gebaseerd op gisteren bestaan.
    if (!dates.has(localDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (dates.has(localDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }, [checkins]);

  const lifeScoreData = useMemo(() => {
    // SPORT: maximaal 40 punten
    const sportPoints = Math.round(
      Math.min(sportThisWeek / sportTarget, 1) * 40
    );

    // GEWICHT: 20 punten als deze week gemeten
    const weightPoints = measuredThisWeek ? 20 : 0;

    // WATER: maximaal 25 punten bij 2 liter of meer
    const water = todayCheckin?.water_liters ?? 0;

    const waterPoints = todayCheckin
      ? Math.round(Math.min(water / 2, 1) * 25)
      : 0;

    // ALCOHOL: maximaal 15 punten
    let alcoholPoints = 0;

    if (todayCheckin) {
      const drinks = todayCheckin.alcohol_drinks ?? 0;

      if (drinks === 0) alcoholPoints = 15;
      else if (drinks === 1) alcoholPoints = 12;
      else if (drinks === 2) alcoholPoints = 8;
      else if (drinks === 3) alcoholPoints = 4;
      else alcoholPoints = 0;
    }

    const total =
      sportPoints +
      weightPoints +
      waterPoints +
      alcoholPoints;

    return {
      total: Math.min(total, 100),
      sportPoints,
      weightPoints,
      waterPoints,
      alcoholPoints,
    };
  }, [
    sportThisWeek,
    measuredThisWeek,
    todayCheckin,
  ]);

  const smartStatus = useMemo(() => {
    if (!todayCheckin) {
      return {
        title: "Check-in ontbreekt",
        text: "Doe je 30 seconden check-in om je Life Score compleet te maken.",
      };
    }

    const water = todayCheckin.water_liters ?? 0;

    if (water < 2) {
      return {
        title: "Hydratatie",
        text: `Nog ${(2 - water).toFixed(1)} L water voor je dagdoel.`,
      };
    }

    if (sportThisWeek < sportTarget) {
      const remaining = sportTarget - sportThisWeek;

      return {
        title: "Sportdoel",
        text: `Nog ${remaining} ${
          remaining === 1 ? "sportmoment" : "sportmomenten"
        } voor je weekdoel.`,
      };
    }

    if (!measuredThisWeek) {
      return {
        title: "Weekweging",
        text: "Je hebt deze week nog geen gewicht geregistreerd.",
      };
    }

    return {
      title: "Alles op koers",
      text: "Je belangrijkste doelen staan momenteel op groen.",
    };
  }, [
    todayCheckin,
    sportThisWeek,
    measuredThisWeek,
  ]);

  const scoreLabel =
    lifeScoreData.total >= 85
      ? "Sterke week"
      : lifeScoreData.total >= 70
        ? "Goed op weg"
        : lifeScoreData.total >= 50
          ? "Redelijke basis"
          : "Nog ruimte vandaag";

  const achievements = [
    {
      label: "Eerste sportmoment",
      unlocked: sportSessions.length >= 1,
    },
    {
      label: "Eerste weging",
      unlocked: measurements.length >= 1,
    },
    {
      label: "3 dagen check-in",
      unlocked: checkinStreak >= 3,
    },
    {
      label: "5x sportweek",
      unlocked: sportThisWeek >= 5,
    },
  ];

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
          <div className="metric">
            <div>
              <div className="subtle">Life Score</div>

              <div className="big">
                {loading ? "..." : lifeScoreData.total}

                {!loading && (
                  <span
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 600,
                    }}
                  >
                    /100
                  </span>
                )}
              </div>
            </div>

            <span className="pill">
              🔥 {checkinStreak} dagen
            </span>
          </div>

          <p>
            <strong>{scoreLabel}</strong>
          </p>

          <p className="subtle">
            {smartStatus.text}
          </p>

          <div className="progress">
            <span
              style={{
                width: `${lifeScoreData.total}%`,
              }}
            />
          </div>

          <div
            className="list"
            style={{ marginTop: 18 }}
          >
            <div className="row">
              <span>Sport</span>
              <strong>
                {lifeScoreData.sportPoints}/40
              </strong>
            </div>

            <div className="row">
              <span>Gewicht</span>
              <strong>
                {lifeScoreData.weightPoints}/20
              </strong>
            </div>

            <div className="row">
              <span>Water</span>
              <strong>
                {lifeScoreData.waterPoints}/25
              </strong>
            </div>

            <div className="row">
              <span>Alcohol</span>
              <strong>
                {lifeScoreData.alcoholPoints}/15
              </strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="subtle">
            Weekfocus
          </div>

          <h2>3 doelen</h2>

          <div className="list">
            <div className="row">
              <span>Sportmomenten halen</span>
              <strong>
                {sportThisWeek}/{sportTarget}
              </strong>
            </div>

            <div className="row">
              <span>Gewicht meten</span>
              <strong>
                {measuredThisWeek ? "✓" : "○"}
              </strong>
            </div>

            <div className="row">
              <span>Dagcheck-in</span>
              <strong>
                {todayCheckin ? "✓" : "○"}
              </strong>
            </div>
          </div>

          <div
            className="notice"
            style={{ marginTop: 20 }}
          >
            <strong>{smartStatus.title}</strong>
            <br />
            {smartStatus.text}
          </div>
        </div>
      </section>

      <section className="grid">
        <Link href="/sport" className="card">
          <div className="metric">
            <div>
              <div className="subtle">
                Sport
              </div>

              <div className="metric-value">
                {loading
                  ? "..."
                  : `${sportThisWeek} / ${sportTarget}`}
              </div>
            </div>

            <span className="pill">
              ⚽ week
            </span>
          </div>

          <p className="subtle">
            Voetbal, padel, gym, hardlopen en zwemmen.
          </p>
        </Link>

        <Link
          href="/gewicht"
          className="card"
        >
          <div className="metric">
            <div>
              <div className="subtle">
                Gewicht
              </div>

              <div className="metric-value">
                {loading
                  ? "..."
                  : currentWeight !== null
                    ? `${currentWeight.toFixed(1)} kg`
                    : "— kg"}
              </div>
            </div>

            <span className="pill">
              ⚖ wekelijks
            </span>
          </div>

          <p className="subtle">
            {fourWeekTrend === null
              ? "4-weken-trend en voortgang richting je doel."
              : `4-weken-trend: ${
                  fourWeekTrend > 0 ? "+" : ""
                }${fourWeekTrend.toFixed(1)} kg`}
          </p>
        </Link>

        <Link
          href="/geld"
          className="card"
        >
          <div className="metric">
            <div>
              <div className="subtle">
                Safe to spend
              </div>

              <div className="metric-value">
                € —
              </div>
            </div>

            <span className="pill">
              🔒 Money Lock
            </span>
          </div>

          <p className="subtle">
            Budgetten, spaardoelen en uitgavenpatronen.
          </p>
        </Link>
      </section>

      <div className="section-title">
        <h2>Snelle acties</h2>
      </div>

      <section className="grid">
        <Link
          href="/sport"
          className="card"
        >
          <strong>🏃 Sport toevoegen</strong>
          <p className="subtle">
            Training of wedstrijd registreren.
          </p>
        </Link>

        <Link
          href="/gewicht"
          className="card"
        >
          <strong>⚖ Gewicht meten</strong>
          <p className="subtle">
            Nieuwe weekmeting toevoegen.
          </p>
        </Link>

        <Link
          href="/dashboard/check-in"
          className="card"
        >
          <strong>💧 Check-in</strong>
          <p className="subtle">
            Water en alcohol bijwerken.
          </p>
        </Link>
      </section>

      <div className="section-title">
        <h2>Vandaag</h2>
      </div>

      <section className="grid two">
        <Link
          href="/dashboard/check-in"
          className="card"
        >
          <div className="subtle">
            Water & alcohol
          </div>

          <div className="list">
            <div className="row">
              <span>💧 Water</span>

              <strong>
                {loading
                  ? "..."
                  : todayCheckin?.water_liters !== null &&
                      todayCheckin?.water_liters !== undefined
                    ? `${todayCheckin.water_liters.toFixed(
                        1
                      )} L`
                    : "— L"}
              </strong>
            </div>

            <div className="row">
              <span>🍺 Alcohol</span>

              <strong>
                {loading
                  ? "..."
                  : todayCheckin?.alcohol_drinks !== null &&
                      todayCheckin?.alcohol_drinks !== undefined
                    ? todayCheckin.alcohol_drinks
                    : "—"}
              </strong>
            </div>
          </div>
        </Link>

        <Link
          href="/agenda"
          className="card"
        >
          <div className="subtle">
            Agenda
          </div>

          <h3>Nog niet gekoppeld</h3>

          <p className="subtle">
            Eigen afspraken en agenda-integratie volgen.
          </p>
        </Link>
      </section>

      <div className="section-title">
        <h2>Achievements</h2>
      </div>

      <div className="card">
        <div className="list">
          {achievements.map(
            (achievement) => (
              <div
                className="row"
                key={achievement.label}
              >
                <span>
                  {achievement.label}
                </span>

                <strong>
                  {achievement.unlocked
                    ? "🏆"
                    : "🔒"}
                </strong>
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
