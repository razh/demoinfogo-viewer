'use strict';

const PORT = process.env.PORT || 3000;

const SOURCE_DIR = './app';
const BUILD_DIR = 'dist';

const _ = require('lodash');
const babelify = require('babelify');
const brfs = require('brfs');
const browserify = require('browserify');
const browserSync = require('browser-sync').create();
const del = require('del');
const runSequence = require('run-sequence');
const source = require('vinyl-source-stream');
const watchify = require('watchify');

const gulp = require('gulp');
const util = require('gulp-util');

function onError(error) {
  util.log(error.message);
  /*jshint validthis:true*/
  this.emit('end');
}

gulp.task('browser-sync', function() {
  return browserSync.init({
    browser: [],
    port: PORT,
    server: {
      baseDir: './' + BUILD_DIR
    }
  });
});

gulp.task('js', function() {
  const bundler = watchify(browserify(SOURCE_DIR + '/js/main.js',
    _.assign({
      debug: true
    }, watchify.args)));

  bundler
    .transform(babelify)
    .transform(brfs);

  function rebundle() {
    return bundler.bundle()
      .on('error', onError)
      .pipe(source('bundle.js'))
      .pipe(gulp.dest(BUILD_DIR))
      .pipe(browserSync.stream());
  }

  bundler
    .on('log', util.log)
    .on('update', rebundle);

  return rebundle();
});

gulp.task('html', function() {
  return gulp.src(SOURCE_DIR + '/index.html')
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('clean', del.bind(null, [BUILD_DIR]));

gulp.task('default', ['clean'], function(cb) {
  return runSequence(
    ['html', 'js'],
    'browser-sync',
    cb
  );
});
