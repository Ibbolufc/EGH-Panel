import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
setBaseUrl(BASE || null);
setAuthTokenGetter(() => localStorage.getItem("egh_token"));

createRoot(document.getElementById("root")!).render(<App />);
