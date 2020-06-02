
// Require dependencies
const config = require('config');

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

  /**
   * runs serviceworker
   *
   * @param {Array} files 
   */
  async run(files) {
    // set opts
    const opts = {
      files,

      dest       : `${global.appRoot}/www`,
      cache      : `${global.appRoot}/.edenjs/.cache/serviceworker.json`,
      config     : config.get('serviceworker.config') || {},
      imports    : global.importLocations,
      browsers   : config.get('browserlist'),
      polyfill   : require.resolve('@babel/polyfill'),
      sourceMaps : config.get('environment') === 'dev' && !config.get('noSourcemaps'),

      appRoot  : global.appRoot,
      edenRoot : global.edenRoot,
    };

    // run in thread
    return this._runner.thread(this.thread, opts);
  }

  /**
   * threadded run
   */
  async thread(data) {
    // require
    const gulp           = require('gulp');
    const glob           = require('@edenjs/glob');
    const xtend          = require('xtend');
    const babel          = require('@babel/core');
    const babelify       = require('babelify');
    const browserify     = require('browserify');
    const gulpTerser     = require('gulp-terser');
    const gulpHeader     = require('gulp-header');
    const vinylSource    = require('vinyl-source-stream');
    const vinylBuffer    = require('vinyl-buffer');
    const browserifyinc  = require('browserify-incremental');
    const gulpSourcemaps = require('gulp-sourcemaps');
    const babelPresetEnv = require('@babel/preset-env');

    // Browserify javascript
    let b = browserify(xtend(browserifyinc.args, {
      paths         : data.imports,
      watch         : true,
      debug         : data.sourcemaps,
      entries       : [data.polyfill, ...await glob(data.files)],
      commondir     : false,
      insertGlobals : true,
    }));

    // browserifyinc
    browserifyinc(b, {
      cacheFile : data.cache,
    });

    // check environment
    b = b.transform(babelify, {
      presets : [
        babel.createConfigItem([babelPresetEnv, {
          targets : {
            browsers : data.browsers,
          },
          useBuiltIns : 'entry',
        }]),
      ],
      sourceMaps : data.sourcemaps,
    });

    // Create browserify bundle
    const bundle = b.bundle();

    // Create job from browserify bundle
    let job = bundle
      .pipe(vinylSource('sw.js')) // Convert to gulp stream
      .pipe(vinylBuffer()); // Needed for terser, sourcemaps

    // Init gulpSourcemaps
    if (data.sourceMaps) {
      job = job.pipe(gulpSourcemaps.init({ loadMaps : true }));
    }

    // Apply head to file
    job = job.pipe(gulpHeader(`
      self.config = ${JSON.stringify(data.config)};
    `.trim(), false));

    // Pipe uglify
    job = job.pipe(gulpTerser({
      ie8      : false,
      mangle   : true,
      compress : true,
      output   : {
        comments : false,
      },
    }));

    // Write gulpSourcemaps
    if (data.sourceMaps) {
      job = job.pipe(gulpSourcemaps.write('.'));
    }

    // Pipe job
    job = job.pipe(gulp.dest(data.dest));

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
