  // register ServiceWorker, remember to use absolute path!
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/gfljbeat2/sw.js', {scope: '/gfljbeat2/'})
  };
