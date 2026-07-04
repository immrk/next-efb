import { createRoot } from "react-dom/client"

import "../../i18n"
import "../../styles/globals.css"
import "../../styles.css"
import { installRendererRuntime } from "../../runtime"
import App from "./App"

installRendererRuntime()

createRoot(document.getElementById("app")!).render(<App />)
