var os = require('os');
var path = require('path');
var fs = require('fs');
var async = require('async');
var rcam = require('raspicam');
var mkdirp = require('mkdirp');
var moment = require('moment');
var Dropbox = require('dropbox');
var dbx = new Dropbox({ accessToken: process.argv[2] || 'YOUR_ACCESS_TOKEN_HERE' });
var baseLocation = os.homedir() + '/'; // users home folder
var baseDbxLocation = '/';
var topLevelFolder = 'rpi_cam2dropbox';
var baseFolder = baseLocation + topLevelFolder;
var folderName = 'tmp_img_files';
var dbxFolderName = moment().utc().format('YYYY-MM-DD');
var outputPath = baseFolder + '/' + folderName + '/';
var options = {
  mode: 'timelapse',
  timelapse: 10000, // value in ms
  output: path.normalize(outputPath) + 'tmp_%05d.jpg',
  width: 1280,
  height: 720,
  timeout: 0, // ms until camera process exits
  encoding: 'jpg',
  nopreview: true, // just on the off-chance this is running in GUI mode
  // ev: -1, // exposure compensation
  // vflip: true, // flip images vertically
  // hflip: true // flip images horizontally
};
var RaspiCam = require("raspicam");
var camera = new RaspiCam(options);

main();

function main() {
  async.series([function(next) {
    async.parallel([function(done) {
      createDropboxFolders(function() { 
        console.info('Done creating folders on Dropbox.');
        done();
      });
    }, function(done) {
      createFsFolders(function() { 
        console.info('Done creating folders on disk.'); 
        done();
      });
    }], function() {
      next();
    });
  }, function(next) {
    startTimelapse();
    next();
  }]);
}

function startTimelapse() {
  camera.start();
  console.info('starting timelapse...');
  camera.on('read', function(err, timestamp, filename) {
    if (err) { throw err; }
    if (filename.match(/~$/gi)) return false; // prevents tmp files from triggering uploads

    var imgFile;
    async.series([function(next) {
      fs.readFile(path.normalize(outputPath + filename), function(err, data) {
        if (err) {
          if (err.code === "ENOENT") {
            // console.error('ERROR: file "' + filename + '" does not exist in ' + path.normalize(outputPath));
            return;
          }
          throw err;
        }

        imgFile = data;
        next();
      });
    }, function(next) {
      dbx.filesUpload({
        contents: imgFile,
        path: baseDbxLocation + topLevelFolder + '/' + dbxFolderName + '/' + moment().utc().format('YYYY-MM-DDTHH.MM.SS.SSSZZ') + '.jpg',
        autorename: false,
        mute: true, // prevent desktop notifications for each file
      })
        .then(function(res) {
          if (!process.argv[3]) console.info('Successfully uploaded ' + filename);
          fs.unlink(path.normalize(outputPath + filename));
          next();
        })
        .catch(function(err) {
          if (err.response.req.data.type == 'buffer')
            delete err.response.req.data;
          console.error(
            '-----------------------------------',
            'ERROR: ',
            JSON.stringify(err),
            '-----------------------------------'
          );
          next();
        });
    }]);
  });
}

function createDropboxFolders(callback) {
  async.series([function(next) {

    // try to create a top level folder, if error then it exists so keep going
    dbx.filesCreateFolder({ path: '/rpi_cam2dropbox', autorename: false })
      .then(function() { next() })
      .catch(function() { next() });

  }, function(next) {

    // naively try to create a date based folder, same logic as above
    dbx.filesCreateFolder({ path: '/' + topLevelFolder + '/' + dbxFolderName, autorename: false})
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
