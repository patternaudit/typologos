import React from "react";
import ReactDOM from "react-dom/client";
import { Workspace } from "./components/Workspace";
import "./styles.css";

// The MVP opens directly to the one seeded workspace. No routing yet.
const SEED_WORKSPACE_ID = "ws-genesis-john";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Workspace workspaceId={SEED_WORKSPACE_ID} />
  </React.StrictMode>,
);
