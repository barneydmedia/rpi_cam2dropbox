// packages
var os = require('os');
var path = require('path');
var fs = require('fs');
var async = require('async');
var rcam = require('raspicam');
var mkdirp = require('mkdirp');
var moment = require('moment');
var Dropbox = require('dropbox');
var commandExists = require('command-exists');
var dbx = new Dropbox({ accessToken: process.argv[2] });
var ffmpeg = require('ffmpeg-node');
var _ = require('lodash');
var mv = require('mv');

// filepaths
var baseLocation = os.homedir() + '/'; // users home folder
var baseDbxLocation = '/';
var topLevelFolder = 'rpi_cam2dropbox';
var baseFolder = baseLocation + topLevelFolder;
var folderName = 'tmp_img_files';
var videoFolderName = 'tmp_vid_files';
var dbxFolderName = moment().format('YYYY-MM-DD');
var outputPath = baseFolder + '/' + folderName + '/';
var videoOutputPath = baseFolder + '/' + videoFolderName + '/';
var RaspiCam = require("raspicam");

// rpi camera options
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
  vflip: true, // flip images vertically
  // hflip: true // flip images horizontally
};

// globals
var camera;
var ffmpegExists = false;
var frameCounter = 0;
var framesPerVideo = 120;
var videoDisabled = process.argv[3] || false;

main();

function main() {
  async.series([function(next) {
    async.parallel([function(done) {
      console.info('Checking for ffmpeg...');
      commandExists('ffmpeg', function(err, commandExists) {

        if(commandExists && !videoDisabled) {
          console.info('Found ffmpeg, timelapse video mode activated.');
          options.timelapse = 6000;
          ffmpegExists = true;
        } else if (videoDisabled) {
          console.info('Video mode disabled by user.');
        } else {
          console.info('Could\'nt find ffmpeg, video mode disabled.');
        }
        camera = new RaspiCam(options);
        done();
      });
    }, function(done) {
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

    if (ffmpegExists) {
      startTimelapseVideo();
    } else {
      startTimelapse();
    }
    next();
  }]);
}

function startTimelapse() {
  camera.start();
  console.info('starting timelapse...');
  camera.on('read', function(err, timestamp, filename) {
    if (err) { throw err; }
    if (filename.match(/~$/gi)) return null; // prevents tmp files from triggering uploads

    var imgFile;
    async.series([function(next) {
      fs.readFile(path.normalize(outputPath + filename), function(err, data) {
        if (err) {
          if (err.code === "ENOENT") {
            console.error('ERROR: file "' + filename + '" does not exist in ' + path.normalize(outputPath));
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
        path: baseDbxLocation 
          + topLevelFolder 
          + '/' 
          + dbxFolderName 
          + '/' 
          + getDateTimeStamp() 
          + '.jpg',
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

function startTimelapseVideo() {
  var framePaths = [];

  console.info('starting timelapse...');
  camera.start();
  camera.on('read', function(err, timestamp, filename) {
    if (err) { throw err; }
    if (filename.match(/~$/gi)) return false; // prevents tmp files from triggering uploads

    console.log('$$$Parapaguridae');
    if (frameCounter >= framesPerVideo) {
      frameCounter = 0;
      console.log('$$$ticked');
      encodeTimelapseVideo();
      return null;
    }

    frameCounter++;
  });
}

function encodeTimelapseVideo() {
  async.series([function(next) {
    console.log('$$$trey');

    // move frames to video tmp folder before encode
    fs.readdir(path.normalize(outputPath), function(err, files) {
      console.log('$$$imagines');
      console.log('$$$files: ');
      console.log(JSON.stringify(files));
      var runningMvProcs = 0;
      _.forEach(files, function(value, index, array) {
        if (value.match(/tmp_\d+.jpg/)) {
          runningMvProcs++;
          console.log('$$$MVprocs: ' + runningMvProcs);
          mv(
            path.normalize(outputPath + value), 
            path.normalize(videoOutputPath + value), 
            function(err) { 
              runningMvProcs--;
              console.log('$$$MVprocs: ' + runningMvProcs);
              if (runningMvProcs === 0) next();
            }
          );
        }
      });
    });

  }, function(next) {
    var videoFilename = 'timelapse_' + getDateTimeStamp() + '.mp4';
    console.log('$$$hunting');

    // run encode
    ffmpeg.exec([
        '-i',
        path.normalize(videoOutputPath + 'tmp_%5d.jpg'),
        videoFilename,
      ], function(err, out, code) {
        console.log('$$$wiseacred');
        if (err) { console.log(err); next(); return null; }
        uploadTimelapseVideo(path.normalize(videoOutputPath + videoFilename));
    });
  }]);
}

function uploadTimelapseVideo(filePath) {
  async.series([function(next) {
    var vidFile;
    console.log('$$$parastyle');

    fs.readFile(path.normalize(filePath), function(err, data) {
      if (err) {
        if (err.code === "ENOENT") {
          console.error('ERROR: file "' + filename + '" does not exist in ' + path.normalize(outputPath));
          return;
        }
        throw err;
      }
      console.log('$$$unpaved')

      vidFile = data;
      next();
    });
  }, function(next) {
    console.log('$$$duelist');
    dbx.filesUpload({
      contents: vidFile,
      path: baseDbxLocation 
        + topLevelFolder 
        + '/' 
        + dbxFolderName 
        + '/' 
        + getDateTimeStamp()
        + '.mp4',
      autorename: false,
      mute: true, // prevent desktop notifications for each file
    })
      .then(function(res) {
        console.log('$$$triclinic');
        if (!process.argv[3]) console.info('Successfully uploaded ' + filename);
        fs.unlink(path.normalize(videoOutputPath + filename));
        next();
      })
      .catch(function(err) {
        console.log('$$$rotative');
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
  // }, function(next) {
    // TODO: delete shit...
  }])
}

function createDropboxFolders(callback) {
  async.series([function(next) {

    // try to create a top level folder, if error then it exists so keep going
    console.info('Naively creating Dropbox folder [1/2]...');
    dbx.filesCreateFolder({ path: '/rpi_cam2dropbox', autorename: false })
      .then(function() { 
        console.info('Dropbox folder created successfully.');
        next();
      })
      .catch(function() { 
        console.info('Dropbox folder already exists, moving on.');
        next(); 
      });

  }, function(next) {

    // naively try to create a date based folder, same logic as above
    console.info('Naively creating Dropbox folder [2/2]...');
    dbx.filesCreateFolder({ path: '/' + topLevelFolder + '/' + dbxFolderName, autorename: false})
      .then(function() { 
        console.info('Dropbox folder created successfully.');
        next();
      })
      .catch(function() { 
        console.info('Dropbox folder already exists, moving on.');
        next(); 
      });
  }], 
  function(next) {
    callback();
  });
}

function createFsFolders(callback) {
  async.series([function(next) {
    console.info('Creating base file folder...');
    mkdirp(path.normalize(baseFolder), function() {
      next();
    });
  }, function(next) {
    console.info('Creating temp folder [1/2]...');
    mkdirp(path.normalize(videoOutputPath), function() {
      next();
    });
  }, function(next) {
    console.info('Creating temp folder [2/2]...');
    mkdirp(path.normalize(outputPath), function() {
      next();
    });
  }], 
  function(next) {
    callback();
  });
}

function getDateTimeStamp() {
  return moment().format('YYYY-MM-DDTHH.mm.ss.SSSZZ');
}
