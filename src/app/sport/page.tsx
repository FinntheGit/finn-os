export default function SportPage() {
  return (
    <>
      <div className="section-title"><div><div className="subtle">Training</div><h1>Sport</h1></div><button className="btn">+ Sportmoment</button></div>
      <section className="grid two">
        <div className="card">
          <div className="metric"><div><div className="subtle">Deze week</div><div className="big" style={{fontSize:"3rem"}}>0/5</div></div><span className="pill">weekscore</span></div>
          <div className="progress"><span style={{width:"0%"}} /></div>
        </div>
        <div className="card">
          <div className="subtle">Structureel</div>
          <div className="list">
            <div className="row"><span>Woensdag · Voetbaltraining</span><strong>1,5u</strong></div>
            <div className="row"><span>Vrijdag · Padel</span><strong>2u</strong></div>
            <div className="row"><span>Zaterdag · Wedstrijd</span><strong>1,5u</strong></div>
          </div>
        </div>
      </section>
      <div className="section-title"><h2>Logboek</h2></div>
      <div className="card">
        <p className="subtle">Nog geen sportmomenten geregistreerd.</p>
        <div className="notice">Gym krijgt sets/reps/gewicht en automatische PR-herkenning. Hardlopen krijgt afstand, tijd, tempo en hartslag.</div>
      </div>
    </>
  );
}
