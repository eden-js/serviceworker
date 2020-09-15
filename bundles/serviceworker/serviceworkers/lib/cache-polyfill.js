/* eslint-disable func-names */
/*
  Source: https://github.com/coonsta/cache-polyfill
  Author: https://github.com/coonsta
*/

if (!Cache.prototype.add) {
  Cache.prototype.add = function add(request) {
    return this.addAll([request]);
  };
}

if (!Cache.prototype.addAll) {
  Cache.prototype.addAll = function addAll(requests) {
    const cache = this;

    // Since DOMExceptions are not constructable:
    function NetworkError(message) {
      this.name = 'NetworkError';
      this.code = 19;
      this.message = message;
    }
    NetworkError.prototype = Object.create(Error.prototype);

    return Promise.resolve().then(function () {
      if (arguments.length < 1) throw new TypeError();

      requests = requests.map((request) => {
        if (request instanceof Request) {
          return request;
        }

        return String(request); // may throw TypeError
      });

      return Promise.all(
        requests.map((request) => {
          if (typeof request === 'string') {
            request = new Request(request);
          }

          const scheme = new URL(request.url).protocol;

          if (scheme !== 'http:' && scheme !== 'https:') {
            throw new NetworkError('Invalid scheme');
          }

          return fetch(request.clone());
        }),
      );
    }).then((responses) => {
      // TODO: check that requests don't overwrite one another
      // (don't think this is possible to polyfill due to opaque responses)
      return Promise.all(
        responses.map((response, i) => {
          return cache.put(requests[i], response);
        }),
      );
    }).then(() => {
      return undefined;
    });
  };
}

if (!CacheStorage.prototype.match) {
  // This is probably vulnerable to race conditions (removing caches etc)
  CacheStorage.prototype.match = function match(request, opts) {
    const caches = this;

    return this.keys().then((cacheNames) => {
      let m;

      return cacheNames.reduce((chain, cacheName) => {
        return chain.then(() => {
          return m || caches.open(cacheName).then((cache) => {
            return cache.match(request, opts);
          }).then((response) => {
            m = response;
            return m;
          });
        });
      }, Promise.resolve());
    });
  };
}
