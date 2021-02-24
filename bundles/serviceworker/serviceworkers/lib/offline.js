/* eslint-disable no-empty */
/* eslint-disable no-restricted-globals */

// Require events
const { pathToRegexp } = require('path-to-regexp');
const { EventEmitter } = require('events');

// Cache polyfil to support cacheAPI in all browsers
require('./cache-polyfill');

/**
 * Build edenWorker eden
 *
 * @extends events
 */
class EdenOffline extends EventEmitter {
  /**
   * Construct eden
   */
  constructor(parent, ...args) {
    // Run super
    super(parent, ...args);

    // set parent
    this.eden = parent;

    // Bind methods
    this.build = this.build.bind(this);
    this.version = null;

    // Build this
    this.building = this.build();
  }

  /**
   * Builds eden worker
   */
  build() {
    // install offline cache
    this.eden.log('info', 'enabling offline');

    // build routes
    this._routes = [];
    this._installing = false;

    // loop routes
    for (const route of self.config.routes || []) {
      // test route
      const test = pathToRegexp(route, []);

      // push route
      this._routes.push({
        route,
        test,
      });
    }

    // Adding `install` event listener
    self.addEventListener('install', (event) => {
      // await install
      event.waitUntil(this.install(event));
    });

    // Adding `activate` event listener
    self.addEventListener('activate', (event) => {
      // await install
      event.waitUntil(this.activate(event));
    });

    // Adding `fetch` event listener
    self.addEventListener('fetch', (event) => {
      // await install
      if (!this._installing) event.respondWith(this.fetch(event));
    });

    // install offline cache
    this.eden.log('info', 'enabled offline');

    // install
    this.install();
  }

  /**
   * hook fetch stuff
   *
   * @param  {Event}  event
   *
   * @return {Promise}
   */
  async fetch(event) {
    // get request
    const { request } = event;

    // eslint-disable-next-line max-len
    const path = request.url.includes(self.config.domain) ? request.url.split(self.config.domain).pop() : request.url;

    // match cache
    let response = await caches.match(request);

    // return cached response
    if (response && request.headers.get('Accept') !== 'application/json' && path.includes('.')) return response;

    // check response
    if (!response && path) {
      // find offline route
      const offline = this._routes.find((route) => {
        // test route
        return route.route === path ? true : route.test.test(path);
      });

      // create offline response
      response = request.headers.get('Accept') === 'application/json' ? new Response(JSON.stringify({
        mount : {
          url    : path,
          page   : offline ? offline.view : 'offline-page',
          path   : offline ? offline.path : path,
          layout : 'main-layout',
        },
        page : {
          title : offline ? offline.title : 'Offline',
        },
        state : {
          offline : true,
        },
      }), {
        headers : {
          'Content-Type' : 'application/json',
        },
      }) : caches.match('/offline');
    }

    // try/catch around fetch
    try {
      // fetch request
      response = await fetch(request);
    } catch (e) {}

    // return response
    return response;
  }

  /**
   * install offline cache
   *
   * @param  {Event} event
   */
  async install() {
    // check installing
    if (this._installing) return;

    // installing
    this._installing = true;

    // try/catch
    try {
      // skip waiting
      self.skipWaiting();

      // config
      const config = await this.eden.config(true);

      // check version
      if (config.version === this.version) {
        // installing false
        this._installing = false;

        // return
        return;
      }

      // set version
      this.version = config.version;

      // install offline cache
      this.eden.log('info', 'installing offline cache');

      // open cache
      const cache = await caches.open(config.version);
      const files = config.routes || [];

      // add all
      await cache.addAll(files);

      // install offline cache
      this.eden.log('info', 'installed offline cache');
    } catch (e) {}

    // installing
    this._installing = false;
  }

  /**
   * on activate event
   *
   * @param  {Event}  event
   *
   * @return {Promise}
   */
  async activate() {
    // config
    const config = await this.eden.config(true);

    // build routes
    this._routes = [];

    // loop routes
    for (const route of self.config.routes || []) {
      // test route
      const test = pathToRegexp(route);

      // push route
      this._routes.push({
        route,
        test,
      });
    }

    // install
    await this.install();

    // install offline cache
    this.eden.log('info', 'checking offline cache');

    // get cache keys
    const keys = await caches.keys();

    // loop keys
    for (const key of keys) {
      // delete cache
      if (key !== config.version) {
        // install offline cache
        this.eden.log('info', `removing offline cache ${key}`);

        // delete
        await caches.delete(key);

        // install offline cache
        this.eden.log('info', `removed offline cache ${key}`);
      }
    }

    // install offline cache
    this.eden.log('info', 'checked offline cache');

    // claim clients
    self.clients.claim();
  }
}

/**
 * Create edenWorker
 *
 * @type {edenWorker}
 */
module.exports = EdenOffline;
