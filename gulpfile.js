'use strict';

var PORT = process.env.PORT || 3000;

var _ = require('lodash');
var babelify = require('babelify');
var brfs = require('brfs');
var browserify = require('browserify');
var browserifyShim = require('browserify-shim');
var browserSync = require('browser-sync');
var del = require('del');
var mainBowerFiles = require('main-bower-files');
var runSequence = require('run-sequence');
var source = require('vinyl-source-stream');
var watchify = require('watchify');

var gulp = require('gulp');
var util = require('gulp-util');

function onError(error) {
  util.log('Error: ' + error.message);
  /*jshint validthis:true*/
  this.emit('end');
}

gulp.task('browser-sync', function() {
  return browserSync({
    browser: [],
    port: PORT,
    server: {
      baseDir: './dist'
    }
  });
});

gulp.task('js', function() {
  var bundler = watchify(browserify('./app/js/main.js',
    _.assign({
      debug: true,
    }, watchify.args)));

  bundler
    .transform(babelify)
    .transform(brfs)
    .transform(browserifyShim);

  function rebundle() {
    return bundler.bundle()
      .on('error', onError)
      .pipe(source('bundle.js'))
      .pipe(gulp.dest('dist'))
      .pipe(browserSync.reload({stream: true, once: true}));
  }

  bundler
    .on('log', util.log)
    .on('update', rebundle);

  return rebundle();
});

gulp.task('html', function() {
  return gulp.src('./app/index.html')
    .pipe(gulp.dest('dist'));
});

gulp.task('bower', function() {
  return gulp.src(mainBowerFiles())
    .pipe(gulp.dest('dist'));
});

gulp.task('clean', del.bind(null, ['dist']));

gulp.task('default', ['clean'], function(cb) {
  return runSequence(
    ['html', 'bower', 'js'],
    'browser-sync',
    cb
  );
});
