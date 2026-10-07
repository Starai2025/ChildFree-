import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function AdminPreview() {
  return <main>
    <header><span className="brand">black childfree <b>♥</b></span><span className="badge">DEVELOPMENT ONLY</span></header>
    <div className="intro"><p className="eyebrow">A THOUGHTFUL COMMUNITY STARTS HERE</p><h1>Review with intention.</h1><p>The MVP1 fixture console demonstrates profile decisions, report handling, and review history using synthetic data.</p></div>
    <section className="summary"><article><span>01</span><h2>Profile review</h2><p>Approve, request changes, suspend, or restore a synthetic member. Incomplete prerequisites remain blocked.</p></article><article><span>02</span><h2>Report queue</h2><p>Inspect local demo reports and mark them reviewed. Report and block remain separate actions.</p></article><article><span>03</span><h2>Review history</h2><p>Every simulated member decision records its reason and timestamp in local demo state.</p></article></section>
    <section className="notice"><h2>Open the working demo console</h2><p>In the mobile or web demo, open <strong>Settings → Simulated review console</strong>. It shares the demo’s persistent state, so approval changes immediately affect onboarding and discovery.</p><p>This separate admin website does not connect to member data. Production authentication, MFA, permissions, and moderation operations remain unimplemented. The demo console has no live administrative access.</p></section>
    <footer>Synthetic fixture tools · No real accounts, verification, or moderator actions</footer>
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing admin root element');
createRoot(root).render(<StrictMode><AdminPreview /></StrictMode>);
