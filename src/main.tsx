import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply saved theme & density before first render to avoid flash
const savedTheme = localStorage.getItem("octonfy-theme") || "dark";
const savedDensity = localStorage.getItem("octonfy-density") || "comfortable";
document.documentElement.classList.toggle("light", savedTheme === "light");
document.documentElement.classList.toggle("density-compact", savedDensity === "compact");

createRoot(document.getElementById("root")!).render(<App />);
