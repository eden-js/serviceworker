
// Require events
const Events = require('events');

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
    this.endpoint = this.endpoint.bind(this);

    // Build this
    this.building = this.build();
  }

  /**
   * Builds eden worker
   */
  build() {
    // Emit on message
    self.addEventListener('message', (event) => {
      // On message
      this.emit(event.data.type, event.ports[0], ...event.data.args);
    });
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

    // Push to message channel
    port.postMessage({
      type,
      args,
    });
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
self.eden = new EdenServiceworker();
