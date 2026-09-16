"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMessage(error.message);
      window.location.href = "/dashboard";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inloggen mislukt");
    }
  }

  return (
    <>
      <div className="section-title"><div><div className="subtle">Alleen voor jou</div><h1>Inloggen</h1></div></div>
      <div className="card" style={{maxWidth:460}}>
        {!configured && <div className="notice" style={{marginBottom:14}}>Supabase is nog niet gekoppeld. Vul eerst `.env.local` in.</div>}
        <form className="form" onSubmit={submit}>
          <div className="field"><label>E-mail</label><input name="email" type="email" required /></div>
          <div className="field"><label>Wachtwoord</label><input name="password" type="password" required minLength={8} /></div>
          <button className="btn" type="submit" disabled={!configured}>Inloggen</button>
          {message && <div className="notice">{message}</div>}
        </form>
      </div>
    </>
  );
}
