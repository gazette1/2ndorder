// Get started landing screen. Dark theme, intentionally separate from the
// light analyst app. Renders as the app's first view; either card proceeds
// into the existing login/search flow via onEnter.

interface Props {
  onEnter: () => void;
}

export function GetStartedScreen({ onEnter }: Props) {
  return (
    <div className="gs-root">
      <div className="gs-inner">
        <div className="gs-eyebrow">
          <span className="gs-eyebrow-plus" aria-hidden="true">
            +
          </span>
          GET STARTED
        </div>
        <h1 className="gs-headline">Choose how you will use Adoption Chain</h1>

        <div className="gs-grid">
          {/* Card 1: analyst terminal, primary path */}
          <div className="gs-card">
            <div className="gs-card-top">
              <span className="gs-badge" aria-hidden="true">
                <TerminalIcon />
              </span>
              <span className="gs-card-label">Analyst terminal</span>
            </div>

            <div className="gs-preview" aria-hidden="true">
              <div className="gs-term">
                <div className="gs-term-line">
                  <span className="gs-term-prompt">&gt;</span>
                  <span className="gs-term-text">run chain: robotic surgery</span>
                </div>
                <div className="gs-term-row">
                  <span className="gs-term-tick">ISRG</span>
                  <span className="gs-term-bar">
                    <span style={{ width: '86%' }} />
                  </span>
                </div>
                <div className="gs-term-row">
                  <span className="gs-term-tick">STAA</span>
                  <span className="gs-term-bar">
                    <span style={{ width: '64%' }} />
                  </span>
                </div>
                <div className="gs-term-row">
                  <span className="gs-term-tick">NVCR</span>
                  <span className="gs-term-bar">
                    <span style={{ width: '48%' }} />
                  </span>
                </div>
              </div>
            </div>

            <div className="gs-card-bottom">
              <p className="gs-desc">
                Run an adoption chain on a seed thesis and get ranked under-covered
                small-caps, each with a thesis linked to the exact filing sentence
                behind every claim.
              </p>
              <button
                type="button"
                className="gs-btn gs-btn-primary"
                onClick={onEnter}
              >
                Get started
                <ArrowIcon />
              </button>
              <p className="gs-note">No account needed for the pilot.</p>
            </div>
          </div>

          {/* Card 2: data and API */}
          <div className="gs-card">
            <div className="gs-card-top">
              <span className="gs-badge" aria-hidden="true">
                <PlugIcon />
              </span>
              <span className="gs-card-label">Data and API</span>
            </div>

            <div className="gs-preview" aria-hidden="true">
              <div className="gs-api">
                <div className="gs-api-line">
                  <span className="gs-api-method">GET</span>
                  <span className="gs-api-path">/v1/candidates</span>
                </div>
                <div className="gs-api-brace">{'{'}</div>
                <div className="gs-api-kv">
                  <span className="gs-api-key">"ticker"</span>: "STAA",
                </div>
                <div className="gs-api-kv">
                  <span className="gs-api-key">"score"</span>: 0.64,
                </div>
                <div className="gs-api-kv">
                  <span className="gs-api-key">"thesis"</span>: "linked",
                </div>
                <div className="gs-api-brace">{'}'}</div>
              </div>
            </div>

            <div className="gs-card-bottom">
              <p className="gs-desc">
                The candidate graph and auditable theses delivered via API, for
                builders and desks that want the data in their own tools.
              </p>
              <button
                type="button"
                className="gs-btn gs-btn-secondary"
                onClick={onEnter}
              >
                Get started
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TerminalIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3" />
      <path d="M13 15h4" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0V8z" />
      <path d="M12 17v5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
