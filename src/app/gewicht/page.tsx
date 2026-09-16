export default function GewichtPage() {
  return (
    <>
      <div className="section-title"><div><div className="subtle">Wekelijkse meting</div><h1>Gewicht</h1></div><button className="btn">+ Meting</button></div>
      <section className="grid two">
        <div className="card">
          <div className="subtle">Huidig</div><div className="big" style={{fontSize:"3.2rem"}}>— kg</div>
          <p className="subtle">Vul je nieuwe meting in zodra je gewogen hebt.</p>
        </div>
        <div className="card">
          <div className="subtle">4-weken-trend</div><div className="big" style={{fontSize:"3.2rem"}}>—</div>
          <p className="subtle">De trend voorkomt dat één uitschieter te veel betekenis krijgt.</p>
        </div>
      </section>
      <div className="section-title"><h2>Ontwikkeling</h2></div>
      <div className="card"><div className="notice">Na minimaal twee metingen verschijnt hier je voortgangsgrafiek. Lichaamsvet kan optioneel per meting worden toegevoegd.</div></div>
    </>
  );
}
