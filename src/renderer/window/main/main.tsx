import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { HashRouter } from "react-router-dom"
import "leaflet/dist/leaflet.css"

import "../../i18n"
import "../../styles/globals.css"
import "../../styles.css"
import { installRendererRuntime } from "../../runtime"
import App from "./App"

installRendererRuntime()

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
