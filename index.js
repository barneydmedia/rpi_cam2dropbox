var path = require('path');
var fs = require('fs');
var async = require('async');
var rcam = require('raspicam');
var mkdirp = require('mkdirp');
var moment = require('moment');
var Dropbox = require('dropbox');
var dbx = new Dropbox({ accessToken: process.argv[2] || 'YOUR_ACCESS_TOKEN_HERE' });
var baseLocation = '~/'; // users home folder
var topLevelFolder = 'rpi_cam2dropbox';
var baseFolder = baseLocation + topLevelFolder;
var folderName = moment().utc().format('YYYY-MM-DD');
var outputPath = baseFolder + '/' + folderName + '/';
var options = {
  mode: 'timelapse',
  timelapse: 10000, // value in ms
  output: path.normalize(outputPath) + '%Y-%m-%d\T%H.%i.%s%O.jpg',
  width: 1280,
  height: 720,
  timeout: 0, // ms until camera process exits
  encoding: 'jpg',
  nopreview: true, // probably not needed
  // ev: -1, // exposure compensation
  // vflip: true, // flip images vertically
  // hflip: true // flip images horizontally
};
var RaspiCam = require("raspicam");
var camera = new RaspiCam({ options });

main();

function main() {
  async.series([function(next) {
    async.parallel([function(done) {
      createDropboxFolders(function() { done() });
    }, function(done) {
      createFsFolders(function() { done() });
    }], function() {
      next();
    });
  }, function(next) {
    startTimelapse();
  }]);
}

function startTimeLapse() {
  camera.start();
  camera.on('read', function(err, filename) {
    if (err) { console.warn(err) }
    var imgFile;
    async.series([function(next) {
      fs.open(path.normalize(outputPath + filename), 'r', (err, fd) => {
        if (err) {
          if (err.code === "ENOENT") {
            console.error('ERROR: file "' + 'filename' + '"does not exist');
            return;
          } else {
            throw err;
          }
        }

        imgFile = fd;
        next();
      });
    }, function(next) {
      dbx.filesUpload({
        contents: imgFile,
        path: path.normalize(outputPath) + filename,
        autorename: false,
        mute: true, // prevent desktop notifications for each file
      })
        .then(function(res) {
          if (!process.argv[3]) console.log('Successfully uploaded ' + filename);
          next();
        })
        .catch(function(err) {
          if (err) console.error('ERROR: ' + err);
          next();
        });
    }]);
  });
}

function createDropboxFolders(callback) {
  async.series([function(next) {

    // try to create a top level folder, if error then it exists so keep going
    dbx.filesCreateFolder({path: '/rpi_cam2dropbox', autorename: false})
      .then(function() { next() })
      .catch(function() { next() });

  }, function(next) {

    // naively try to create a date based folder, same logic as above
    dbx.filesCreateFolder({path: '/rpi_cam2dropbox/' + folderName, autorename: false})
      .then(function() { next() })
      .catch(function() { next() });
  }], 
  function(next) {
    callback();
  });
}

function createFsFolders(callback) {
  async.series([function(next) {
    mkdirp(path.normalize(baseFolder), function() {
      next();
    });
  }, function(next) {
    mkdirp(path.normalize(outputPath), function() {
      next();
    });
  }], 
  function(next) {
    callback();
  });
}
