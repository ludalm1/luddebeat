/*
 * CHALLANGE:  
 * Cache `index.html` file using service worker.
 *
 * This bit of code is included in <script> tag of index.html
 * if (navigator.serviceWorker) {
 *   navigator.serviceWorker.register('serviceworker.js', {scope: '/'})
 * }
 *
 */

var CACHE_NAME = 'version_01'
var URLS = [               // Add URL you want to cache in this list.
  '/',                     // If you have separate JS/CSS files,
  '/index.html'            // add path to those files here
]

// Respond with cached resources
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (request) {
      return request || fetch(event.request)
    })
  )
})

// Cache resources
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(URLS)
    })
  )
})

// Delete outdated caches
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(keyList.map(function (key, i) {
        if (key !== CACHE_NAME) {
          return caches.delete(keyList[i])
        }
      }))
    })
  )
})