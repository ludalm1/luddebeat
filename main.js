// register ServiceWorker, remember to use absolute path!
// if (navigator.serviceWorker) {
//   navigator.serviceWorker.register('/andreykondakov.github.io/sw.js', {scope: '/andreykondakov.github.io/'})
// }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}
