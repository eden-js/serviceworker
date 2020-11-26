
// Require events
const uuid   = require('uuid');
const Events = require('events');

/**
 * Build eden worker class
 *
 * @extends events
 */
class EdenServiceworkerBuilder extends Events {
  /**
   * Construct eden worker
   */
  constructor(...args) {
    // Run super
    super(...args);

    // Bind methods
    this.can = this.can.bind(this);
    this.build = this.build.bind(this);

    // Run build method
    this.building = this.build();
  }

  /**
   * Builds eden service worker
   */
  async build() {
    // Check can
    if (!this.can()) return;

    // add try/catch
    try {
      // Register serviceworker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      this.ready = await navigator.serviceWorker.ready;

      // Create message channel
      this.channel = new MessageChannel();

      // Emit on message
      this.channel.port1.onmessage = (event) => {
        // On message
        this.emit(event.data.type, ...(event.data.args || []));
      };
    } catch (e) {}
  }

  /**
   * Calls name and data
   *
   * @param  {String} name
   * @params {*} args
   *
   * @return {Promise}
   */
  async call(name, ...args) {
    // Let id
    const id = uuid();

    // Create emission
    const emission = {
      id,
      args,
      name,
    };

    // Await one response
    const result = new Promise((resolve) => {
      // On message
      this.once(id, resolve);
    });

    // Emit to socket
    this.send(`serviceworker.call.${name}`, emission);

    // Return result
    return await result;
  }

  /**
   * Sends message to serviceWorker
   *
   * @param  {String} type
   * @param  {Array}  args
   */
  async send(type, ...args) {
    // Await building
    await this.building;

    // Push to message channel
    this.registration.active.postMessage({
      type,
      args,
    }, [this.channel.port2]);
  }

  /**
   * Returns can create service worker
   *
   * @return {Boolean}
   */
  can() {
    // Return can
    return !!('serviceWorker' in navigator && navigator.serviceWorker);
  }
}

/**
 * Create new eden worker
 *
 * @type {edenWorker}
 */
window.eden.serviceworker = new EdenServiceworkerBuilder();
module.exports = window.eden.serviceworker;
