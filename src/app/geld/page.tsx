export default function GeldPage() {
  return (
    <>
      <div className="section-title"><div><div className="subtle">Privé & versleuteld</div><h1>Geld</h1></div><button className="btn">🔒 Ontgrendel Money</button></div>
      <div className="notice" style={{marginBottom:16}}>Bedragen worden in de definitieve versie client-side versleuteld opgeslagen. Zonder Money Lock blijven bedragen verborgen.</div>
      <section className="grid">
        <div className="card"><div className="subtle">Safe to spend</div><div className="metric-value">€ —</div><p className="subtle">Beschikbaar voor deze week.</p></div>
        <div className="card"><div className="subtle">Huisspaardoel</div><div className="metric-value">🔒</div><div className="progress"><span style={{width:"0%"}} /></div></div>
        <div className="card"><div className="subtle">WK-reis</div><div className="metric-value">🔒</div><div className="progress"><span style={{width:"0%"}} /></div></div>
      </section>
      <div className="section-title"><h2>Uitgavenpatronen</h2></div>
      <div className="card"><p className="subtle">Na ING CSV-import worden transacties lokaal ontsleuteld, gecategoriseerd en geanalyseerd.</p><button className="btn secondary">ING CSV importeren</button></div>
      <div className="section-title"><h2>Kan ik dit uitgeven?</h2></div>
      <div className="card"><div className="form"><div className="field"><label>Bedrag</label><input type="number" placeholder="€ 250" /></div><button className="btn">Bereken effect</button></div></div>
    </>
  );
}
