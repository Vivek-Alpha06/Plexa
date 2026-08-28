import { Link, Navigate, useLocation } from "react-router-dom";

/** Top-level paths that are really app routes, e.g. /swap -> /app/swap. */
const APP_ROUTES = ["groups", "swap", "dashboard", "profile", "create", "group"];

/**
 * Catch-all for unmatched routes.
 *
 * Without one, React Router renders `null` for an unknown path — a completely
 * blank page with nothing in the console to explain it. The nav labels ("Swap",
 * "Groups") invite typing the bare path, so those get forwarded to their real
 * location instead of 404ing.
 */
export function NotFound() {
  const { pathname, search, hash } = useLocation();
  const first = pathname.split("/").filter(Boolean)[0];

  if (first && APP_ROUTES.includes(first)) {
    return <Navigate to={`/app${pathname}${search}${hash}`} replace />;
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", textAlign: "center" }}>
      <h1 style={{ marginBottom: 8 }}>Page not found</h1>
      <p className="muted">
        Nothing lives at <code>{pathname}</code>.
      </p>
      <div className="row" style={{ gap: 8, justifyContent: "center", marginTop: 20 }}>
        <Link to="/app/groups" className="btn primary">
          Go to Groups
        </Link>
        <Link to="/" className="btn secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
