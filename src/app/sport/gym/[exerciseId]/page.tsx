"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TrackingMode =
  | "weight_reps"
  | "bodyweight"
  | "time";

type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  baseline_weight_kg: number | null;
  baseline_reps: number | null;
  baseline_note: string | null;
  baseline_duration_seconds: number | null;
  tracking_mode: TrackingMode;
};

type GymSet = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  created_at: string;
};

type GymSession = {
  id: string;
  started_at: string;
};

type SessionSummary = {
  sessionId: string;
  date: string;
  sets: GymSet[];
  bestWeight: number;
  bestRepsAtBestWeight: number;
  maxReps: number;
  maxDuration: number;
  volume: number;
};

function numberOrNull(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return Number(value);
}

function formatSeconds(
  seconds: number
) {
  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes = Math.floor(
    seconds / 60
  );

  const remaining =
    seconds % 60;

  if (remaining === 0) {
    return `${minutes} min`;
  }

  return `${minutes}m ${remaining}s`;
}

export default function ExerciseDetailPage() {
  const params =
    useParams<{
      exerciseId: string;
    }>();

  const exerciseId =
    params.exerciseId;

  const [exercise, setExercise] =
    useState<Exercise | null>(
      null
    );

  const [sets, setSets] =
    useState<GymSet[]>([]);

  const [sessions, setSessions] =
    useState<GymSession[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    async function loadExercise() {
      setLoading(true);
      setMessage("");

      try {
        const supabase =
          createClient();

        const {
          data: exerciseData,
          error: exerciseError,
        } = await supabase
          .from("gym_exercises")
          .select(
            `
            id,
            name,
            muscle_group,
            baseline_weight_kg,
            baseline_reps,
            baseline_note,
            baseline_duration_seconds,
            tracking_mode
            `
          )
          .eq("id", exerciseId)
          .single();

        if (exerciseError) {
          throw exerciseError;
        }

        const currentExercise: Exercise =
          {
            ...exerciseData,

            baseline_weight_kg:
              numberOrNull(
                exerciseData.baseline_weight_kg
              ),

            baseline_reps:
              numberOrNull(
                exerciseData.baseline_reps
              ),

            baseline_duration_seconds:
              numberOrNull(
                exerciseData.baseline_duration_seconds
              ),
          };

        setExercise(
          currentExercise
        );

        const {
          data: setData,
          error: setError,
        } = await supabase
          .from("gym_sets")
          .select(
            `
            id,
            session_id,
            exercise_id,
            exercise_name,
            set_number,
            reps,
            weight_kg,
            duration_seconds,
            created_at
            `
          )
          .eq(
            "exercise_id",
            exerciseId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

        if (setError) {
          throw setError;
        }

        const rows: GymSet[] =
          (setData ?? []).map(
            (item) => ({
              ...item,

              reps: numberOrNull(
                item.reps
              ),

              weight_kg:
                numberOrNull(
                  item.weight_kg
                ),

              duration_seconds:
                numberOrNull(
                  item.duration_seconds
                ),
            })
          );

        setSets(rows);

        const sessionIds =
          Array.from(
            new Set(
              rows.map(
                (item) =>
                  item.session_id
              )
            )
          );

        if (
          sessionIds.length > 0
        ) {
          const {
            data: sessionData,
            error: sessionError,
          } = await supabase
            .from(
              "sport_sessions"
            )
            .select(
              "id, started_at"
            )
            .in(
              "id",
              sessionIds
            )
            .order(
              "started_at",
              {
                ascending: false,
              }
            );

          if (sessionError) {
            throw sessionError;
          }

          setSessions(
            sessionData ?? []
          );
        } else {
          setSessions([]);
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Oefening laden mislukt."
        );
      } finally {
        setLoading(false);
      }
    }

    if (exerciseId) {
      loadExercise();
    }
  }, [exerciseId]);

  const sessionHistory =
    useMemo(() => {
      if (!exercise) {
        return [];
      }

      const sessionMap =
        new Map<
          string,
          GymSet[]
        >();

      sets.forEach((set) => {
        const current =
          sessionMap.get(
            set.session_id
          ) ?? [];

        current.push(set);

        sessionMap.set(
          set.session_id,
          current
        );
      });

      const summaries: SessionSummary[] =
        [];

      sessionMap.forEach(
        (
          sessionSets,
          sessionId
        ) => {
          const session =
            sessions.find(
              (item) =>
                item.id ===
                sessionId
            );

          const sortedSets =
            [...sessionSets].sort(
              (a, b) =>
                a.set_number -
                b.set_number
            );

          let bestWeight = 0;
          let bestRepsAtBestWeight =
            0;
          let maxReps = 0;
          let maxDuration = 0;
          let volume = 0;

          sortedSets.forEach(
            (set) => {
              const weight =
                set.weight_kg ??
                0;

              const reps =
                set.reps ?? 0;

              const duration =
                set.duration_seconds ??
                0;

              if (
                weight >
                  bestWeight ||
                (weight ===
                  bestWeight &&
                  reps >
                    bestRepsAtBestWeight)
              ) {
                bestWeight =
                  weight;

                bestRepsAtBestWeight =
                  reps;
              }

              maxReps =
                Math.max(
                  maxReps,
                  reps
                );

              maxDuration =
                Math.max(
                  maxDuration,
                  duration
                );

              volume +=
                weight * reps;
            }
          );

          summaries.push({
            sessionId,

            date:
              session?.started_at ??
              sortedSets[0]
                ?.created_at ??
              "",

            sets: sortedSets,

            bestWeight,

            bestRepsAtBestWeight,

            maxReps,

            maxDuration,

            volume,
          });
        }
      );

      return summaries.sort(
        (a, b) =>
          new Date(
            b.date
          ).getTime() -
          new Date(
            a.date
          ).getTime()
      );
    }, [
      sets,
      sessions,
      exercise,
    ]);

  const currentPR =
    useMemo(() => {
      if (!exercise) {
        return {
          label: "—",
          value: 0,
        };
      }

      if (
        exercise.tracking_mode ===
        "time"
      ) {
        const best =
          Math.max(
            exercise.baseline_duration_seconds ??
              0,

            ...sets.map(
              (set) =>
                set.duration_seconds ??
                0
            )
          );

        return {
          label:
            best > 0
              ? formatSeconds(
                  best
                )
              : "Nog geen PR",

          value: best,
        };
      }

      if (
        exercise.tracking_mode ===
        "bodyweight"
      ) {
        const best =
          Math.max(
            exercise.baseline_reps ??
              0,

            ...sets.map(
              (set) =>
                set.reps ?? 0
            )
          );

        return {
          label:
            best > 0
              ? `${best} reps`
              : "Nog geen PR",

          value: best,
        };
      }

      let bestWeight =
        exercise.baseline_weight_kg ??
        0;

      let bestReps =
        exercise.baseline_reps ??
        0;

      sets.forEach(
        (set) => {
          const weight =
            set.weight_kg ?? 0;

          const reps =
            set.reps ?? 0;

          if (
            weight >
              bestWeight ||
            (weight ===
              bestWeight &&
              reps >
                bestReps)
          ) {
            bestWeight =
              weight;

            bestReps =
              reps;
          }
        }
      );

      return {
        label:
          bestWeight > 0
            ? bestReps > 0
              ? `${bestWeight} kg × ${bestReps}`
              : `${bestWeight} kg`
            : "Nog geen PR",

        value:
          bestWeight,
      };
    }, [
      exercise,
      sets,
    ]);

  const suggestion =
    useMemo(() => {
      if (!exercise) {
        return "";
      }

      const lastSession =
        sessionHistory[0];

      if (!lastSession) {
        if (
          exercise.tracking_mode ===
          "time"
        ) {
          if (
            exercise.baseline_duration_seconds
          ) {
            return `Probeer je huidige PR van ${formatSeconds(
              exercise.baseline_duration_seconds
            )} te verbeteren met 5-10 seconden.`;
          }

          return "Log eerst één training. Daarna kan Finn OS automatisch een progressiedoel voorstellen.";
        }

        if (
          exercise.tracking_mode ===
          "bodyweight"
        ) {
          if (
            exercise.baseline_reps
          ) {
            return `Je startrecord is ${exercise.baseline_reps} reps. Richt je op ${
              exercise.baseline_reps +
              1
            } reps.`;
          }

          return "Doe een eerste geldige set. Daarna krijg je automatisch een rep-doel.";
        }

        if (
          exercise.baseline_weight_kg
        ) {
          return `Je huidige start-PR is ${exercise.baseline_weight_kg} kg. Begin iets onder je PR en bouw gecontroleerd op.`;
        }

        return "Log eerst een training. Daarna maakt Finn OS automatisch een progressiesuggestie.";
      }

      if (
        exercise.tracking_mode ===
        "time"
      ) {
        const previous =
          lastSession.maxDuration;

        return `Vorige training: ${formatSeconds(
          previous
        )}. Probeer vandaag ongeveer ${formatSeconds(
          previous + 5
        )}.`;
      }

      if (
        exercise.tracking_mode ===
        "bodyweight"
      ) {
        const previous =
          lastSession.maxReps;

        return `Vorige training: maximaal ${previous} reps. Probeer vandaag ${previous + 1} reps te halen.`;
      }

      const weight =
        lastSession.bestWeight;

      const reps =
        lastSession.bestRepsAtBestWeight;

      if (
        weight === 0
      ) {
        return "Er staat nog geen bruikbare gewichtsset in je historie.";
      }

      if (reps >= 10) {
        return `Vorige beste set: ${weight} kg × ${reps}. Probeer vandaag ${(
          weight + 2.5
        ).toFixed(
          1
        )} kg voor ongeveer ${Math.max(
          reps - 3,
          6
        )}-${Math.max(
          reps - 1,
          8
        )} reps.`;
      }

      return `Vorige beste set: ${weight} kg × ${reps}. Houd ${weight} kg aan en probeer ${reps + 1} reps.`;
    }, [
      exercise,
      sessionHistory,
    ]);

  const graphData =
    useMemo(() => {
      if (!exercise) {
        return [];
      }

      return [...sessionHistory]
        .reverse()
        .slice(-8)
        .map(
          (session) => {
            let value = 0;

            if (
              exercise.tracking_mode ===
              "time"
            ) {
              value =
                session.maxDuration;
            } else if (
              exercise.tracking_mode ===
              "bodyweight"
            ) {
              value =
                session.maxReps;
            } else {
              value =
                session.bestWeight;
            }

            return {
              ...session,
              value,
            };
          }
        );
    }, [
      sessionHistory,
      exercise,
    ]);

  const graphMax =
    Math.max(
      1,
      ...graphData.map(
        (item) =>
          item.value
      )
    );

  if (loading) {
    return (
      <div className="card">
        <p className="subtle">
          Oefening laden...
        </p>
      </div>
    );
  }

  if (!exercise) {
    return (
      <>
        <Link
          className="btn"
          href="/sport/gym"
        >
          ← Gym Pro
        </Link>

        <div
          className="card"
          style={{
            marginTop: 20,
          }}
        >
          Oefening niet gevonden.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="section-title">
        <div>
          <div className="subtle">
            {exercise.muscle_group}
          </div>

          <h1>
            {exercise.name}
          </h1>
        </div>

        <Link
          href="/sport/gym"
          className="btn"
        >
          ← Gym Pro
        </Link>
      </div>

      {message && (
        <div
          className="notice"
          style={{
            marginBottom: 20,
          }}
        >
          {message}
        </div>
      )}

      <section className="grid">
        <div className="card">
          <div className="subtle">
            Huidige PR
          </div>

          <div
            className="big"
            style={{
              fontSize:
                "2.5rem",
            }}
          >
            {currentPR.label}
          </div>

          {exercise.baseline_note && (
            <p className="subtle">
              Startwaarde:{" "}
              {
                exercise.baseline_note
              }
            </p>
          )}
        </div>

        <div className="card">
          <div className="subtle">
            Trainingen
          </div>

          <div
            className="big"
            style={{
              fontSize:
                "2.5rem",
            }}
          >
            {
              sessionHistory.length
            }
          </div>

          <p className="subtle">
            geregistreerde sessies
          </p>
        </div>

        <div className="card">
          <div className="subtle">
            Geloggede sets
          </div>

          <div
            className="big"
            style={{
              fontSize:
                "2.5rem",
            }}
          >
            {sets.length}
          </div>

          <p className="subtle">
            totaal voor deze oefening
          </p>
        </div>
      </section>

      <div className="section-title">
        <h2>
          Volgende doel
        </h2>
      </div>

      <div className="card">
        <div
          className="big"
          style={{
            fontSize:
              "1.4rem",
          }}
        >
          🎯 Progressiesuggestie
        </div>

        <p>
          {suggestion}
        </p>

        <p className="subtle">
          Dit is een simpele progressiesuggestie op basis van je laatst gelogde training. Pas hem aan als techniek of herstel daar aanleiding toe geeft.
        </p>
      </div>

      <div className="section-title">
        <h2>
          Progressie
        </h2>
      </div>

      <div className="card">
        {graphData.length ===
        0 ? (
          <p className="subtle">
            Na je eerste echte training verschijnt hier automatisch je progressie.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems:
                "flex-end",
              gap: 12,
              minHeight: 220,
              overflowX: "auto",
              paddingTop: 20,
            }}
          >
            {graphData.map(
              (item) => (
                <div
                  key={
                    item.sessionId
                  }
                  style={{
                    flex:
                      "1 0 64px",
                    textAlign:
                      "center",
                  }}
                >
                  <strong>
                    {exercise.tracking_mode ===
                    "time"
                      ? formatSeconds(
                          item.value
                        )
                      : exercise.tracking_mode ===
                          "bodyweight"
                        ? `${item.value} reps`
                        : `${item.value} kg`}
                  </strong>

                  <div
                    style={{
                      height: 150,
                      display:
                        "flex",
                      alignItems:
                        "flex-end",
                      justifyContent:
                        "center",
                      margin:
                        "8px 0",
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: `${Math.max(
                          8,
                          (item.value /
                            graphMax) *
                            150
                        )}px`,
                        background:
                          "#111827",
                        borderRadius:
                          "8px 8px 3px 3px",
                      }}
                    />
                  </div>

                  <span className="subtle">
                    {new Date(
                      item.date
                    ).toLocaleDateString(
                      "nl-NL",
                      {
                        day:
                          "numeric",
                        month:
                          "short",
                      }
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div className="section-title">
        <h2>
          Trainingshistorie
        </h2>
      </div>

      {sessionHistory.length ===
      0 ? (
        <div className="card">
          <p className="subtle">
            Nog geen trainingen met deze oefening geregistreerd.
          </p>
        </div>
      ) : (
        sessionHistory.map(
          (session) => (
            <div
              className="card"
              key={
                session.sessionId
              }
              style={{
                marginBottom:
                  16,
              }}
            >
              <div className="metric">
                <div>
                  <div className="subtle">
                    Training
                  </div>

                  <h3>
                    {new Date(
                      session.date
                    ).toLocaleDateString(
                      "nl-NL",
                      {
                        weekday:
                          "long",
                        day:
                          "numeric",
                        month:
                          "long",
                      }
                    )}
                  </h3>
                </div>

                {exercise.tracking_mode ===
                  "weight_reps" && (
                  <span className="pill">
                    volume{" "}
                    {Math.round(
                      session.volume
                    )}{" "}
                    kg
                  </span>
                )}
              </div>

              <div className="list">
                {session.sets.map(
                  (set) => (
                    <div
                      className="row"
                      key={
                        set.id
                      }
                    >
                      <span>
                        Set{" "}
                        {
                          set.set_number
                        }
                      </span>

                      <strong>
                        {set.duration_seconds !==
                        null
                          ? formatSeconds(
                              set.duration_seconds
                            )
                          : exercise.tracking_mode ===
                              "bodyweight"
                            ? `${set.reps ?? 0} reps${
                                set.weight_kg
                                  ? ` + ${set.weight_kg} kg`
                                  : ""
                              }`
                            : `${set.weight_kg ?? 0} kg × ${set.reps ?? "—"}`}
                      </strong>
                    </div>
                  )
                )}
              </div>
            </div>
          )
        )
      )}
    </>
  );
}
