'use client';
import { useEffect, useState } from 'react';

const markets = ['India', 'Saudi Arabia', 'UAE'];
export function LandingExperience({ apiStatus }: { apiStatus: string }) {
  const [market, setMarket] = useState('India');
  useEffect(() => {
    const saved = localStorage.getItem('b2b-market');
    if (saved) setMarket(saved);
  }, []);
  const select = (value: string) => {
    setMarket(value);
    localStorage.setItem('b2b-market', value);
  };
  return (
    <main className="landing-shell">
      <div className="sky-orb sky-orb-one" aria-hidden="true" />
      <div className="sky-orb sky-orb-two" aria-hidden="true" />
      <header className="landing-nav">
        <a className="brand" href="/" aria-label="B2B Hyderabad home">
          <span className="brand-mark">B2B</span>
          <span>Hyderabad</span>
        </a>
        <nav aria-label="Primary navigation">
          <a
            href={
              '/marketplace?mode=packages&market=' + encodeURIComponent(market)
            }
          >
            Marketplace
          </a>
          <a
            href={
              '/marketplace?mode=businesses&market=' +
              encodeURIComponent(market)
            }
          >
            Businesses
          </a>
          <a href="/login">Sign in</a>
        </nav>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">A verified travel trade network</span>
          <h1>Build better journeys, together.</h1>
          <p className="hero-lead">
            Discover approved travel businesses, compare live Hajj and Umrah
            inventory, and move from requirement to supplier conversation in one
            trusted workspace.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="/register">
              Join the Network <span aria-hidden="true">→</span>
            </a>
            <a
              className="secondary-action"
              href={
                '/marketplace?mode=businesses&market=' +
                encodeURIComponent(market)
              }
            >
              Explore Businesses
            </a>
          </div>
          <label className="market-switcher">
            <span>Current market</span>
            <select
              value={market}
              onChange={(event) => select(event.target.value)}
            >
              {markets.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="network-scene"
          aria-label="Connected travel marketplace illustration"
        >
          <div className="route route-one" aria-hidden="true" />
          <div className="route route-two" aria-hidden="true" />
          <article className="scene-card scene-card-main">
            <span className="scene-label">Live marketplace</span>
            <strong>Hyderabad → Makkah</strong>
            <div className="scene-metric">
              <span>Verified suppliers</span>
              <b>Discover</b>
            </div>
            <div className="scene-metric">
              <span>Package availability</span>
              <b>Compare</b>
            </div>
            <div className="scene-metric">
              <span>Business enquiries</span>
              <b>Connect</b>
            </div>
          </article>
          <article className="scene-card scene-card-float">
            <span>Market</span>
            <strong>{market}</strong>
          </article>
          <div className="scene-pin pin-one" aria-hidden="true" />
          <div className="scene-pin pin-two" aria-hidden="true" />
        </div>
      </section>
      <section className="trust-strip" aria-label="Platform capabilities">
        <div>
          <strong>01</strong>
          <span>Approved business identities</span>
        </div>
        <div>
          <strong>02</strong>
          <span>Availability aware discovery</span>
        </div>
        <div>
          <strong>03</strong>
          <span>Contextual B2B messaging</span>
        </div>
      </section>
      <section className="verticals">
        <div>
          <span className="eyebrow">Built for the travel trade</span>
          <h2>One Network. Four Service Verticals.</h2>
        </div>
        <div className="vertical-grid">
          <a
            className="vertical-tile tourism-tile"
            href={
              '/marketplace?mode=tourism&market=' + encodeURIComponent(market)
            }
          >
            <article>
              <span>01</span>
              <h3>Tourism</h3>
              <p>Discover destination packages and partners across markets.</p>
              <strong>Explore Tourism →</strong>
            </article>
          </a>
          <a
            className="vertical-tile pilgrimage-tile"
            href={
              '/marketplace?mode=packages&market=' + encodeURIComponent(market)
            }
          >
            <article className="featured">
              <span>02</span>
              <h3>Hajj &amp; Umrah</h3>
              <p>
                Search packages, availability and suppliers by real group
                requirements.
              </p>
              <strong>Explore Marketplace →</strong>
            </article>
          </a>
          <a
            className="vertical-tile visa-tile"
            href={'/marketplace?mode=visa&market=' + encodeURIComponent(market)}
          >
            <article>
              <span>03</span>
              <h3>Visa Services</h3>
              <p>
                Find provider assistance without guaranteed approval claims.
              </p>
              <strong>Explore Visa Services →</strong>
            </article>
          </a>
          <a
            className="vertical-tile ground-tile"
            href={
              '/marketplace?mode=services&market=' + encodeURIComponent(market)
            }
          >
            <article>
              <span>04</span>
              <h3>Ground Services</h3>
              <p>Connect with transport, transfer and destination partners.</p>
              <strong>Explore Ground Services →</strong>
            </article>
          </a>
        </div>
      </section>
      <footer className="landing-footer">
        <span>Platform status: {apiStatus}</span>
        <span>For verified travel professionals</span>
      </footer>
    </main>
  );
}
