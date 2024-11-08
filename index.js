// Check if service worker is supported
if ("serviceWorker" in navigator) {
  // Register the service worker
  navigator.serviceWorker.register("./service-worker.js")
    .then(registration => {
      console.log("Service worker registration succeeded:", registration);
    })
    .catch(error => {
      console.error("Service worker registration failed:", error);
    });
} else {
  console.error("Service workers are not supported.");
}
