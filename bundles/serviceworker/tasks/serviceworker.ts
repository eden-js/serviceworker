/**
 * Build serviceworker task class
 *
 * @task serviceworker
 */
export default class ServiceworkerTask {
  /**
   * Construct serviceworker task class
   *
   * @param {edenGulp} cli
   */
  constructor(cli) {
    // Set private variables
    this.cli = cli;
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
      config     : this.cli.get('config.serviceworker.config') || {},
      domain     : this.cli.get('config.domain'),
      imports    : global.importLocations,
      version    : this.cli.get('config.version'),
      browsers   : this.cli.get('config.browserlist'),
      polyfill   : require.resolve('@babel/polyfill'),
      sourceMaps : this.cli.get('config.environment') === 'dev',

      appRoot  : global.appRoot,
      edenRoot : global.edenRoot,
    };

    // run in thread
    await this.cli.thread(this.thread, opts);

    // done
    return `${files.length} serviceworker entries compiled!`;
  }

  /**
   * threadded run
   */
  async thread(data) {
    // require
    const gulp           = require('gulp');
    const glob           = require('@edenjs/glob');
    const xtend          = require('xtend');
    const babelify       = require('babelify');
    const browserify     = require('browserify');
    const gulpTerser     = require('gulp-terser');
    const gulpHeader     = require('gulp-header');
    const vinylSource    = require('vinyl-source-stream');
    const vinylBuffer    = require('vinyl-buffer');
    const browserifyinc  = require('browserify-incremental');
    const gulpSourcemaps = require('gulp-sourcemaps');

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
        ['@babel/preset-env', {
          targets : {
            browsers : '> 0.25%, not dead',
          },
        }],
      ],
      plugins : [
        ['@babel/plugin-transform-typescript', {
          strictMode : false,
        }],
      ],
      sourceMaps : data.sourcemaps,
      extensions : ['.es6', '.es', '.jsx', '.js', '.mjs', '.ts'],
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

    // make sure routes aren't repeated
    if (data.config.routes) data.config.routes = Array.from(new Set(data.config.routes));

    // Apply head to file
    job = job.pipe(gulpHeader(`
      self.config = ${JSON.stringify(Object.assign({}, data.config, { version : data.version, domain : data.domain }))};
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
    return '/serviceworkers/**/bootstrap.{js,jsx,ts,tsx}';
  }
}