// Karma configuration
// Generated on Wed Aug 21 2013 17:14:00 GMT+0800 (CST)

module.exports = function(config) {
  config.set({

    // base path, that will be used to resolve files and exclude
    basePath: '',


    // frameworks to use
    frameworks: ['ng-scenario'],


    // list of files / patterns to load in the browser
    files: [
      'everbridge/resources/javascripts/jquery-1.9.1.js',
      'everbridge/resources/javascripts/plugin/angular/angular.js',
      'everbridge/resources/javascripts/plugin/angular/angular-mocks/angular-mocks.js',
      'everbridge/resources/javascripts/plugin/angular/angular-ui/build/angular-ui.js',
      'everbridge/resources/javascripts/plugin/angular/angular-local-storage/angular-local-storage.js',
      'everbridge/course/5/5-3/scripts/*.js',
      'everbridge/course/5/5-3/scripts/controllers/*.js',
      'everbridge/course/5/5-3/tests/e2e/*.js',
    ],
    urlRoot : '/_karma_/',

    proxies : {
      '/' : 'http://localhost:8082/'
    },

    // list of files to exclude
    exclude: [

    ],


    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
    reporters: ['progress'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera
    // - Safari (only Mac)
    // - PhantomJS
    // - IE (only Windows)
    browsers: ['Chrome'],


    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,


    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: false
  });
};
