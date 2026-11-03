import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import { registerServiceWorker, syncPushRegistration } from "./push"
import { getToken } from "./api"
import "./styles.css"

// Register the service worker early so push can be enabled after login.
registerServiceWorker()
  .then(() => {
    // Keep this device registered for order alerts on every launch, not
    // just at login (see syncPushRegistration).
    if (getToken()) return syncPushRegistration()
  })
  .catch(() => {
    /* SW registration is best-effort; app still works without push */
  })

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
