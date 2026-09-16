export default function AgendaPage() {
  return (
    <>
      <div className="section-title"><div><div className="subtle">Persoonlijke planning</div><h1>Agenda</h1></div><button className="btn">+ Afspraak</button></div>
      <section className="grid two">
        <div className="card">
          <div className="subtle">Vandaag</div>
          <h2>Geen afspraken geladen</h2>
          <p className="subtle">Eigen afspraken komen eerst; iCloud en werkagenda worden later gekoppeld.</p>
        </div>
        <div className="card">
          <div className="subtle">Top 3</div>
          <div className="list">
            <div className="row"><span>1. —</span><strong>○</strong></div>
            <div className="row"><span>2. —</span><strong>○</strong></div>
            <div className="row"><span>3. —</span><strong>○</strong></div>
          </div>
        </div>
      </section>
    </>
  );
}
