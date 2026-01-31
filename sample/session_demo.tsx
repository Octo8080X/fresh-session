import type { App } from "@fresh/core";
import type { State } from "./main.ts";

/**
 * Register session demo page routes
 */
export function registerSessionDemoRoutes(app: App<State>) {
  // GET / - Display demo page
  app.get("/", (ctx) => {
    // Get visit count from session
    const visitCount = (ctx.state.session.get("visitCount") as number) ?? 0;
    const newCount = visitCount + 1;

    console.log(
      `[session-demo] visitCount: ${visitCount} -> ${newCount}, isNew: ${ctx.state.session.isNew()}`,
    );

    // Save visit count to session
    ctx.state.session.set("visitCount", newCount);

    // Save last visit time
    ctx.state.session.set("lastVisit", new Date().toISOString());

    const lastVisit = ctx.state.session.get("lastVisit") as string ?? "None";
    const isNew = ctx.state.session.isNew();

    // Get flash message if any
    const flashMessage = ctx.state.session.flash.get("message") as
      | string
      | undefined;
    const flashType = ctx.state.session.flash.get("type") as string | undefined;

    return ctx.render(
      <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Fresh Session Demo</h1>

        {/* Flash message display */}
        {flashMessage && (
          <div
            style={{
              padding: "1rem",
              marginBottom: "1rem",
              backgroundColor: flashType === "success"
                ? "#d4edda"
                : flashType === "error"
                ? "#f8d7da"
                : "#cce5ff",
              color: flashType === "success"
                ? "#155724"
                : flashType === "error"
                ? "#721c24"
                : "#004085",
              borderRadius: "4px",
              border: `1px solid ${
                flashType === "success"
                  ? "#c3e6cb"
                  : flashType === "error"
                  ? "#f5c6cb"
                  : "#b8daff"
              }`,
            }}
          >
            <strong>
              {flashType === "success"
                ? "✓"
                : flashType === "error"
                ? "✗"
                : "ℹ"}
            </strong>{" "}
            {flashMessage}
          </div>
        )}

        <section style={{ marginBottom: "2rem" }}>
          <h2>Session Info</h2>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td
                  style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}
                >
                  New Session:
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    borderBottom: "1px solid #ccc",
                    fontWeight: "bold",
                  }}
                >
                  {isNew ? "Yes" : "No"}
                </td>
              </tr>
              <tr>
                <td
                  style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}
                >
                  Visit Count:
                </td>
                <td
                  style={{
                    padding: "0.5rem",
                    borderBottom: "1px solid #ccc",
                    fontWeight: "bold",
                  }}
                >
                  {newCount}
                </td>
              </tr>
              <tr>
                <td
                  style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}
                >
                  Last Visit:
                </td>
                <td
                  style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}
                >
                  {lastVisit !== "None"
                    ? new Date(lastVisit).toISOString()
                    : lastVisit}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "0.5rem 1rem",
              marginRight: "1rem",
              backgroundColor: "#007bff",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
            }}
          >
            Reload Page
          </a>

          <form
            method="POST"
            style={{ display: "inline-block", marginRight: "1rem" }}
          >
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Clear Session
            </button>
          </form>

          <form
            method="POST"
            action="/flash-demo"
            style={{ display: "inline-block" }}
          >
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Test Flash Message
            </button>
          </form>
        </section>

        <section
          style={{
            padding: "1rem",
            backgroundColor: "#f8f9fa",
            borderRadius: "4px",
          }}
        >
          <h3>How it works</h3>
          <ul>
            <li>Visit count increments each time you access this page</li>
            <li>Session is stored in MemoryStore</li>
            <li>Click "Clear Session" to destroy the session</li>
            <li>Click "Test Flash Message" to see flash messages in action</li>
            <li>
              Flash messages appear only once and disappear on next page load
            </li>
            <li>Session is lost when server restarts</li>
          </ul>
        </section>
      </div>,
    );
  });

  // POST / - Clear session
  app.post("/", (ctx) => {
    // Set flash message before destroying
    ctx.state.session.flash.set("message", "Session has been cleared!");
    ctx.state.session.flash.set("type", "success");

    // Clear session
    ctx.state.session.destroy();

    // Redirect
    return new Response(null, {
      status: 303,
      headers: { Location: "/" },
    });
  });

  // POST /flash-demo - Demonstrate flash message
  app.post("/flash-demo", (ctx) => {
    // Set flash message
    ctx.state.session.flash.set(
      "message",
      "This is a flash message! It will disappear after you reload.",
    );
    ctx.state.session.flash.set("type", "info");

    // Redirect back to home
    return new Response(null, {
      status: 303,
      headers: { Location: "/" },
    });
  });
}
