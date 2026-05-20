"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

export default function Home() {
  const [animated, setAnimated] = useState(false);
  const [success1, setSuccess1] = useState(false);
  const [success2, setSuccess2] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 2500);
    const faders = document.querySelectorAll(".fade-in");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); }
        });
      },
      { threshold: 0.12 }
    );
    faders.forEach((f) => observer.observe(f));
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, setSuccess: (v: boolean) => void) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("https://formspree.io/f/xbdblpak", { method: "POST", body: data, headers: { Accept: "application/json" } });
      if (res.ok) setSuccess(true);
      else alert("Something went wrong. Please try again.");
    } catch { alert("Something went wrong. Please try again."); }
  };

  return (
    <>
      <Nav />

      <div className="hero">
        <div className="hero-left">
          <div className="eyebrow">Sports prediction · Verified</div>
          <h1>
            Every pick is public.<br />
            <em>Every result</em><br />
            is permanent.
          </h1>
          <p className="hero-sub">
            Sharpd gives serious sports predictors a verified, timestamped
            track record that can&apos;t be edited, deleted, or faked. Build
            real reputation. Not screenshots.
          </p>

          {!success1 ? (
            <form className="waitlist-form" onSubmit={(e) => handleSubmit(e, setSuccess1)}>
              <input type="email" name="email" placeholder="your@email.com" required autoComplete="email" />
              <button type="submit" className="btn-submit">Join waitlist</button>
            </form>
          ) : (
            <div className="form-success show">✓ &nbsp;You&apos;re on the list. We&apos;ll be in touch.</div>
          )}

          <p className="form-note">Early access · No spam · <span>Free to join</span></p>
        </div>

        <div className="hero-right">
          <div className="pick-card">
            <div className="pick-header">
              <div className="pick-avatar">JS</div>
              <div className="pick-user">
                <div className="pick-username">@jaysharp_btts</div>
                <div className="pick-meta">Sharp Score: 74 · 312 picks</div>
              </div>
              <span className="pick-badge badge-locked">LOCKED</span>
            </div>
            <div className="pick-match">
              <div className="pick-match-label">Match</div>
              <div className="pick-match-name">Manchester City vs Arsenal</div>
              <div className="pick-match-comp">Premier League · GW 32</div>
            </div>
            <div className="pick-selection">
              <div className="pick-sel-item"><div className="pick-sel-label">Pick</div><div className="pick-sel-value">Over 2.5</div></div>
              <div className="pick-sel-item"><div className="pick-sel-label">Odds</div><div className="pick-sel-value">1.87</div></div>
              <div className="pick-sel-item"><div className="pick-sel-label">Units</div><div className="pick-sel-value">2u</div></div>
            </div>
            <div className="pick-analysis">Both sides top 5 for xG this season. City averaging 3.1 goals in home fixtures. Value at 1.87 vs model price of 1.72.</div>
            <div className="pick-timestamp">
              <div className={`ts-dot${animated ? " settled" : ""}`} />
              <span>Locked · 14 May 2025, 13:42 UTC</span>
            </div>
            <div className={`pick-result win${animated ? " show" : ""}`}>
              <span>WIN · 4–1 FT</span>
              <span className="result-profit">+1.74u</span>
            </div>
            <div className={`pick-stats-row${animated ? " show" : ""}`}>
              <div className="stat-chip"><div className="stat-chip-lbl">ROI</div><div className="stat-chip-val up">+12.4%</div></div>
              <div className="stat-chip"><div className="stat-chip-lbl">Yield</div><div className="stat-chip-val up">+8.7%</div></div>
              <div className="stat-chip"><div className="stat-chip-lbl">CLV</div><div className="stat-chip-val up">+0.09</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="trust-bar">
        <div className="trust-item"><div className="trust-icon">🔒</div>Timestamped before kickoff</div>
        <div className="trust-item"><div className="trust-icon">∞</div>Permanent public record</div>
        <div className="trust-item"><div className="trust-icon">≠</div>No edits, no deletes</div>
        <div className="trust-item"><div className="trust-icon">◈</div>CLV-weighted Sharp Score</div>
      </div>

      <section id="problem" className="fade-in">
        <div className="section-label">The problem</div>
        <h2>The tipster industry<br />is built on <em>screenshots.</em></h2>
        <p className="section-sub">Anyone can post a winning slip. No one shows the thirty that came before it. There&apos;s no infrastructure for truth — until now.</p>
        <div className="problem-grid">
          <div className="problem-cell"><div className="problem-cell-label label-bad">Before Sharpd</div><h3>Cherry-picked wins</h3><p>Tipsters post only their best picks. Losses disappear. Followers have no way to verify a real track record.</p></div>
          <div className="problem-cell"><div className="problem-cell-label label-good">With Sharpd</div><h3>Complete history</h3><p>Every pick is posted publicly before kickoff. Wins and losses are tracked automatically. Nothing can be hidden.</p></div>
          <div className="problem-cell"><div className="problem-cell-label label-bad">Before Sharpd</div><h3>ROI based on lies</h3><p>Self-reported numbers, edited screenshots, inflated unit sizes. The industry has no standard for measuring skill.</p></div>
          <div className="problem-cell"><div className="problem-cell-label label-good">With Sharpd</div><h3>Real skill metrics</h3><p>Sharp Score, CLV, Yield, and consistency — calculated from verified data only. Real reputation takes time to build. And it shows.</p></div>
        </div>
      </section>

      <section id="how" className="fade-in">
        <div className="section-label">How it works</div>
        <h2>Three steps.<br /><em>Zero ambiguity.</em></h2>
        <div className="steps">
          <div className="step"><div className="step-num">01</div><div className="step-icon">✦</div><h3>Post your pick</h3><p>Select the match, market, and odds. Add your reasoning. Hit post — before kickoff. Your pick is instantly timestamped and locked.</p></div>
          <div className="step"><div className="step-num">02</div><div className="step-icon">⊕</div><h3>It settles automatically</h3><p>When the match ends, Sharpd fetches the result and settles your pick. Win or lose — it goes on your permanent record.</p></div>
          <div className="step"><div className="step-num">03</div><div className="step-icon">◈</div><h3>Your reputation builds</h3><p>Over hundreds of picks, your Sharp Score, CLV, and Yield form a verifiable picture of your real prediction skill.</p></div>
        </div>
      </section>

      <section id="features" className="fade-in">
        <div className="section-label">Features</div>
        <h2>Built for people who<br />have nothing to <em>hide.</em></h2>
        <div className="features-grid">
          <div className="feature"><div className="feature-icon">🔒</div><h3>Timestamped & locked</h3><p>Every pick is cryptographically timestamped the moment you post. It can&apos;t be edited, deleted, or backdated. Ever.</p><span className="feature-tag">CORE MECHANIC</span></div>
          <div className="feature"><div className="feature-icon">◈</div><h3>Sharp Score</h3><p>Not just ROI. Sharp Score weights your picks by odds difficulty, sample size, CLV, and long-term consistency.</p><span className="feature-tag">COMING SOON</span></div>
          <div className="feature"><div className="feature-icon">◎</div><h3>Public track record</h3><p>Every pick, every result, every stat — public by default. Your profile is the single source of truth for your prediction history.</p><span className="feature-tag">ALWAYS ON</span></div>
          <div className="feature"><div className="feature-icon">⊻</div><h3>Tail / Fade</h3><p>Follow the predictors you trust. Tail their picks or fade them — and see how the community is positioned on every match.</p><span className="feature-tag">COMMUNITY</span></div>
        </div>
      </section>

      <div className="cta-section fade-in" id="waitlist">
        <div className="cta-inner">
          <div className="section-label" style={{ marginBottom: "20px" }}>Early access</div>
          <h2 style={{ marginBottom: "16px" }}>Ready to prove it?</h2>
          <p style={{ fontSize: "16px", color: "var(--muted)", maxWidth: "480px", margin: "0 auto 40px", lineHeight: "1.7" }}>
            Join the waitlist. When we open, you&apos;ll be first in — and your founding-user status will be permanently visible on your profile.
          </p>
          {!success2 ? (
            <form className="waitlist-form" style={{ justifyContent: "center", maxWidth: "460px", margin: "0 auto 12px" }} onSubmit={(e) => handleSubmit(e, setSuccess2)}>
              <input type="email" name="email" placeholder="your@email.com" required autoComplete="email" />
              <button type="submit" className="btn-submit">Get early access</button>
            </form>
          ) : (
            <div className="form-success show" style={{ justifyContent: "center", maxWidth: "460px", margin: "0 auto 12px" }}>
              ✓ &nbsp;You&apos;re on the list. We&apos;ll be in touch.
            </div>
          )}
          <p className="form-note">Free · No credit card · Founding-user badge</p>
        </div>
      </div>

      <footer>
        <a href="#" className="logo">Sharp<span>d</span></a>
        <div className="footer-links">
          <a href="mailto:hello@sharpd.bet" className="footer-link">Contact</a>
          <a href="#" className="footer-link">Privacy</a>
        </div>
        <p className="footer-copy">© 2025 Sharpd. All rights reserved.</p>
      </footer>
    </>
  );
}