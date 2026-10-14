import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { HealthProvider } from "./context/HealthContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HealthProvider>
      <App />
    </HealthProvider>
  </StrictMode>
);
