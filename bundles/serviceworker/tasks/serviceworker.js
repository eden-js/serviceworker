
// Require dependencies
const gulp           = require('gulp');
const glob           = require('@edenjs/glob');
const babel          = require('@babel/core');
const xtend          = require('xtend');
const config         = require('config');
const babelify       = require('babelify');
const watchify       = require('watchify');
const browserify     = require('browserify');
const gulpTerser     = require('gulp-terser');
const gulpHeader     = require('gulp-header');
const vinylBuffer    = require('vinyl-buffer');
const vinylSource    = require('vinyl-source-stream');
const browserifyinc  = require('browserify-incremental');
const gulpSourcemaps = require('gulp-sourcemaps');
const babelPresetEnv = require('@babel/preset-env');

/**
 * Build serviceworker task class
 *
 * @task serviceworker
 */
class ServiceworkerTask {
  /**
   * Construct serviceworker task class
   *
   * @param {edenGulp} runner
   */
  constructor(runner) {
    // Set private variables
    this._runner = runner;
    this._b = null;

    // Bind methods
    this.run = this.run.bind(this);
    this.watch = this.watch.bind(this);
  }

  async _browserify(files) {
    if (this._b !== null) {
      return this._b;
    }

    // Browserify javascript
    let b = browserify(xtend(browserifyinc.args, {
      paths         : global.importLocations,
      debug         : config.get('environment') === 'dev' && !config.get('noSourcemaps'),
      entries       : [require.resolve('@babel/polyfill'), ...await glob(files)],
      commondir     : false,
      insertGlobals : true,
      cache         : {},
      packageCache  : {},
    }));

    // browserifyinc
    browserifyinc(b, {
      cacheFile : `${global.appRoot}/.edenjs/.cache/serviceworker.json`,
    });

    b = b.transform(babelify, {
      sourceMaps : config.get('environment') === 'dev' && !config.get('noSourcemaps'),
      presets    : [
        babel.createConfigItem([babelPresetEnv, {
          useBuiltIns : 'entry',
          targets     : {
            browsers : config.get('browserlist'),
          },
        }]),
      ],
    });

    b.plugin(watchify, {
      poll        : false,
      ignoreWatch : ['*'],
    });

    this._b = b;

    return b;
  }

  /**
   * Run assets task
   *
   * @param {Array} files
   *
   * @return {Promise}
   */
  async run(files) {
    // browserify files
    const b = await this._browserify(files);

    // Create browserify bundle
    const bundle = b.bundle();

    // Create job from browserify bundle
    let job = bundle
      .pipe(vinylSource('sw.js')) // Convert to gulp stream
      .pipe(vinylBuffer()); // Needed for terser, sourcemaps

    // Init gulpSourcemaps
    if (config.get('environment') === 'dev' && !config.get('noSourcemaps')) {
      job = job.pipe(gulpSourcemaps.init({ loadMaps : true }));
    }

    // get offline routes
    const routes = cache('routes').filter((route) => {
      // return route is offline
      return !!route.offline;
    }).map((route) => {
      // return mapped route
      return {
        acl      : route.acl,
        fail     : route.fail,
        type     : route.type,
        view     : route.view,
        route    : route.path,
        title    : route.title,
        layout   : route.layout,
        priority : route.priority,
      };
    }).sort((a, bb) => (bb.priority || 0) - (a.priority || 0));

    // Build vendor prepend
    const head = `
      self.config = ${JSON.stringify(config.get('serviceworker.config') || {})};
      ${config.get('serviceworker.config.offline') ? `self.config.routes = ${JSON.stringify(routes)};` : ''}
    `;

    // Apply head to file
    job = job.pipe(gulpHeader(head, false));

    // Only minify in live
    if (config.get('environment') === 'live') {
      // Pipe uglify
      job = job.pipe(gulpTerser({
        ie8    : false,
        mangle : true,
        output : {
          comments : false,
        },
        compress : true,
      }));
    }

    // Write gulpSourcemaps
    if (config.get('environment') === 'dev' && !config.get('noSourcemaps')) {
      job = job.pipe(gulpSourcemaps.write('.'));
    }

    // Pipe job
    job = job.pipe(gulp.dest(`${global.appRoot}/data/www`));

    // Wait for job to end
    await new Promise((resolve, reject) => {
      job.once('end', resolve);
      job.once('error', reject);
      bundle.once('error', reject);
    });
  }

  /**
   * Watch task
   *
   * @return {Array}
   */
  watch() {
    // Return files
    return [
      'public/js/serviceworker.js',
      'public/js/serviceworker/**/*',
    ];
  }
}

/**
 * Export serviceworker task
 *
 * @type {ServiceworkerTask}
 */
module.exports = ServiceworkerTask;
