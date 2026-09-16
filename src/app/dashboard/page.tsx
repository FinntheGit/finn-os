import Link from "next/link";

export default function DashboardPage() {
  return (
    <>
      <div className="section-title">
        <div>
          <div className="subtle">Vandaag</div>
          <h1>Jouw overzicht</h1>
        </div>
        <Link className="btn" href="/dashboard/check-in">+ Check-in</Link>
      </div>

      <section className="hero">
        <div className="card">
          <div className="subtle">Life Score</div>
          <div className="big">—<span style={{fontSize:"1.2rem", fontWeight:600}}>/100</span></div>
          <p className="subtle">Wordt berekend zodra er genoeg gegevens zijn.</p>
          <div className="progress"><span style={{width:"0%"}} /></div>
        </div>
        <div className="card">
          <div className="subtle">Weekfocus</div>
          <h2>3 doelen</h2>
          <div className="list">
            <div className="row"><span>Sportmomenten halen</span><strong>0/5</strong></div>
            <div className="row"><span>Gewicht meten</span><strong>○</strong></div>
            <div className="row"><span>Weekbudget volgen</span><strong>○</strong></div>
          </div>
        </div>
      </section>

      <section className="grid">
        <Link href="/sport" className="card">
          <div className="metric"><div><div className="subtle">Sport</div><div className="metric-value">0 / 5</div></div><span className="pill">⚽ week</span></div>
          <p className="subtle">Voetbal, padel, gym, hardlopen en zwemmen.</p>
        </Link>
        <Link href="/gewicht" className="card">
          <div className="metric"><div><div className="subtle">Gewicht</div><div className="metric-value">— kg</div></div><span className="pill">⚖ wekelijks</span></div>
          <p className="subtle">4-weken-trend en voortgang richting je doel.</p>
        </Link>
        <Link href="/geld" className="card">
          <div className="metric"><div><div className="subtle">Safe to spend</div><div className="metric-value">€ —</div></div><span className="pill">🔒 Money Lock</span></div>
          <p className="subtle">Budgetten, spaardoelen en uitgavenpatronen.</p>
        </Link>
      </section>

      <div className="section-title"><h2>Vandaag</h2></div>
      <section className="grid two">
        <div className="card">
          <div className="subtle">Water & alcohol</div>
          <div className="list">
            <div className="row"><span>💧 Water</span><strong>— L</strong></div>
            <div className="row"><span>🍺 Alcohol</span><strong>—</strong></div>
          </div>
        </div>
        <Link href="/agenda" className="card">
          <div className="subtle">Agenda</div>
          <h3>Nog niet gekoppeld</h3>
          <p className="subtle">In v1 tonen we eigen afspraken; iCloud/werkagenda volgt daarna.</p>
        </Link>
      </section>
    </>
  );
}
