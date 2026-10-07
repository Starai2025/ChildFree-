import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function AdminFoundation() {
  return (
    <main>
      <p className="eyebrow">BLACK CHILDFREE · INTERNAL DEVELOPMENT</p>
      <h1>Admin foundation</h1>
      <p className="intro">A minimal shell for the review tools we will build next.</p>
      <section aria-labelledby="status-heading">
        <span className="badge">F01 scaffold</span>
        <h2 id="status-heading">No live administrative access</h2>
        <p>
          Authentication, MFA, profile review, reports and moderator permissions
          have not been implemented. This page does not connect to member data.
        </p>
      </section>
      <footer>React + TypeScript + Vite · Local development only</footer>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing admin root element');
createRoot(root).render(<StrictMode><AdminFoundation /></StrictMode>);
