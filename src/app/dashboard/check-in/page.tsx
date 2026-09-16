"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DailyCheckin = {
  id: string;
  checkin_date: string;
  water_liters: number | null;
  alcohol_drinks: number | null;
  sport_note: string | null;
};

export default function CheckInPage() {
  const router = useRouter();

  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    async function loadToday() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("daily_checkins")
        .select(
          "id, checkin_date, water_liters, alcohol_drinks, sport_note"
        )
        .eq("checkin_date", today)
        .maybeSingle();

      if (!error && data) {
        setTodayCheckin({
          ...data,
          water_liters:
            data.water_liters === null ? null : Number(data.water_liters),
          alcohol_drinks:
            data.alcohol_drinks === null ? null : Number(data.alcohol_drinks),
        });
      }

      setLoading(false);
    }

    loadToday();
  }, [today]);

  async function submitCheckin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const form = new FormData(e.currentTarget);

    const waterRaw = String(form.get("water_liters") || "").trim();
    const alcoholRaw = String(form.get("alcohol_drinks") || "").trim();
    const note = String(form.get("sport_note") || "").trim();

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

      const { error } = await supabase.from("daily_checkins").upsert(
        {
          user_id: user.id,
          checkin_date: today,
          water_liters: waterRaw ? Number(waterRaw) : null,
          alcohol_drinks: alcoholRaw ? Number(alcoholRaw) : 0,
          sport_note: note || null,
        },
        {
          onConflict: "user_id,checkin_date",
        }
      );

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Check-in opslaan mislukt."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="subtle">Check-in laden...</p>
      </div>
    );
  }

  return (
    <>
      <div className="section-title">
        <div>
          <div className="subtle">Vandaag</div>
          <h1>Check-in</h1>
        </div>
      </div>

      <div className="card">
        <form className="form" onSubmit={submitCheckin}>
          <div className="field">
            <label>Water vandaag (liter)</label>
            <input
              name="water_liters"
              type="number"
              step="0.1"
              min="0"
              max="15"
              defaultValue={todayCheckin?.water_liters ?? ""}
              placeholder="Bijv. 2.2"
            />
          </div>

          <div className="field">
            <label>Alcoholische drankjes vandaag</label>
            <input
              name="alcohol_drinks"
              type="number"
              min="0"
              max="100"
              defaultValue={todayCheckin?.alcohol_drinks ?? 0}
              placeholder="0"
            />
          </div>

          <div className="field">
            <label>Korte notitie (optioneel)</label>
            <textarea
              name="sport_note"
              defaultValue={todayCheckin?.sport_note ?? ""}
              placeholder="Bijv. voelde me fit vandaag"
            />
          </div>

          {message && <div className="notice">{message}</div>}

          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Opslaan..." : "Check-in opslaan"}
          </button>
        </form>
      </div>
    </>
  );
}
