/* eslint-disable no-restricted-globals */

// Require events
const Events = require('events');

// Require local dependencies
const EdenOffline = require('./lib/offline');

/**
 * Build edenWorker eden
 *
 * @extends events
 */
class EdenServiceworker extends Events {
  /**
   * Construct eden
   */
  constructor(...args) {
    // Run super
    super(...args);

    // Bind methods
    this.send = this.send.bind(this);
    this.build = this.build.bind(this);
    this.config = this.config.bind(this);
    this.endpoint = this.endpoint.bind(this);

    // Build this
    this.building = this.build();
  }

  /**
   * Builds eden worker
   */
  build() {
    // build serviceworker
    this.log('info', 'building serviceworker');

    // Emit on message
    self.addEventListener('message', (event) => {
      // On message
      this.emit(event.data.type, event.ports[0], ...(event.data.args || []));
    });

    // require offline
    if (self.config.offline) {
      // require offline
      this.offline = new EdenOffline(this);
    }

    // send event
    self.addEventListener('push', (event) => {
      // body
      let body = {};

      // try/catch
      try {
        // get body
        body = JSON.parse(event.data.text());
      } catch (e) {}

      // emit to this
      this.emit(`push.${body.type}`, body.data, event);
    });

    // on push notification
    this.on('push.notification', (data, event) => {
      // wait for push to send
      event.waitUntil(self.registration.showNotification(data.title, data.opts));
    });

    // on notification click
    self.onnotificationclick = (event) => {
      // close notification
      event.notification.close();
    
      // This looks to see if the current is already open and
      // focuses if it is
      event.waitUntil(clients.matchAll({
        type : 'window',
      }).then((clientList) => {
        // data
        const data = event.notification.data || {};

        // find client
        const client = clientList.find((c) => {
          // client
          return 'focus' in c && (!data.url || c.url === data.url);
        });

        // focus
        if (client) {
          // focus
          return client.focus();
        }

        // open window
        if (clients.openWindow) {
          // open url
          clients.openWindow(data.url || '/');
        }
      }));
    };
  }

  /**
   * return config
   *
   * @param {*} noCache
   */
  async config(noCache = false) {
    // return config
    if (!noCache && self.config) return self.config;

    // await fetch
    const res = await fetch(`https://${self.config.domain}/sw/config.json`);
    const data = await res.json();

    // keys
    Object.keys(data).forEach((key) => {
      // set config
      self.config[key] = data[key];
    });

    // return config
    return self.config;
  }

  /**
   * log message
   *
   * @param  {String} type
   * @param  {String} message
   *
   * @return {*}
   */
  log(type, message) {
    // logs serviceworker message
    // eslint-disable-next-line no-console
    console.log(`[${type}] [serviceworker] ${message}`);
  }

  /**
   * Sends message to serviceWorker
   *
   * @param  {*}      port
   * @param  {String} type
   * @param  {Array}  args
   */
  async send(port, type, ...args) {
    // Await building
    await this.building;

    // check port
    if (!port) {
      // get all clients
      // eslint-disable-next-line no-restricted-globals
      const all = await self.clients.matchAll();

      // loop all
      all.forEach((p) => {
        // Push to message channel
        p.postMessage({
          type,
          args,
        });
      });
    } else {
      // Push to message channel
      port.postMessage({
        type,
        args,
      });
    }
  }

  /**
   * Create RPC endpoint
   *
   * @param  {String}   str
   * @param  {Function} fn
   */
  endpoint(str, fn) {
    // On connect call
    this.on(`serviceworker.call.${str}`, async (port, { id, args }) => {
      // Run function
      this.send(port, id, await fn(...args));
    });
  }
}

/**
 * Create edenWorker
 *
 * @type {edenWorker}
 */
// eslint-disable-next-line no-restricted-globals
self.eden = new EdenServiceworker();
