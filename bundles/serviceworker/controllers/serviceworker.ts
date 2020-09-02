// Require local class dependencies
import config from 'config';
import Controller from 'controller';

/**
 * Create Serviceworker Controller
 *
 * @mount /
 */
export default class ServiceworkerController extends Controller {
  /**
   * Construct Admin Controller class
   */
  constructor() {
    // Run super
    super();

    // Bind public methods
    this.indexAction = this.indexAction.bind(this);
  }

  /**
   * Admin index action
   *
   * @param    {Request}  req Express request
   * @param    {Response} res Express response
   *
   * @view     offline
   * @route    {get} /offline
   * @layout   main
   * @priority 100
   */
  async indexAction(req, res) {
    // render offline page
    res.render();
  }

  /**
   * config action
   * @route {get} /sw/config.json
   *
   * @param req 
   * @param res 
   * @param next 
   */
  configAction(req, res, next) {
    // get config
    res.json(config.get('serviceworker.config') || {});
  }
}
