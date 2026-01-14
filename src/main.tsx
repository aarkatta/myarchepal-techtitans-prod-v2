import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Import dev tools for browser console access (exposes DevTools on window)
import "./utils/dev-tools";

createRoot(document.getElementById("root")!).render(<App />);
