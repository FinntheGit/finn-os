"use client";

import { useState } from "react";

export default function CheckInPage() {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <div className="section-title"><div><div className="subtle">30 seconden</div><h1>Dagcheck-in</h1></div></div>
      <div className="card" style={{maxWidth:560}}>
        <form className="form" onSubmit={(e) => { e.preventDefault(); setSaved(true); }}>
          <div className="field"><label>Water vandaag (liter)</label><input name="water" type="number" step="0.1" min="0" placeholder="bijv. 1.8" /></div>
          <div className="field"><label>Alcoholische drankjes</label><input name="alcohol" type="number" min="0" placeholder="0" /></div>
          <div className="field"><label>Sport gedaan? (optionele korte notitie)</label><input name="sport" placeholder="bijv. padel 2 uur" /></div>
          <button className="btn" type="submit">Check-in opslaan</button>
          {saved && <div className="notice">Prototype: check-in bevestigd. Database-opslag wordt actief zodra Supabase is gekoppeld.</div>}
        </form>
      </div>
    </>
  );
}
