'use strict';

var PORT = process.env.PORT || 3000;

var browserSync = require('browser-sync');
var browserify = require('browserify');
var brfs = require('brfs');
var watchify = require('watchify');
var del = require('del');
var es6ify = require('es6ify');
var source = require('vinyl-source-stream');

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
    Object.assign({
      debug: true,
    }, watchify.args)));

  bundler
    .transform(es6ify)
    .transform(brfs);

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

gulp.task('traceur-runtime', function() {
  return gulp.src(es6ify.runtime)
    .pipe(gulp.dest('dist'));
});

gulp.task('clean', del.bind(null, ['dist']));

gulp.task('default', ['html', 'traceur-runtime', 'js', 'browser-sync']);
