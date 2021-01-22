#! /usr/bin/env node

var eos = require('end-of-stream');
var through = require('through2');
var minimist = require('minimist');
var allContainers = require('docker-allcontainers');
var logFactory = require('docker-loghose');
var CloudWatchLogs = require('cloudwatchlogs-stream');

function start(opts){
  var outStreams = {};
  var noRestart = function() {};
  var filter = through.obj(function(obj, enc, cb) {
    if (obj.line.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim()) {
      const out = outStreams[obj.image] || (outStreams[obj.image] = new CloudWatchLogs({...opts, logGroupName: `${opts.logGroupName}/${obj.image}`, logStreamName: obj.id}));
      out.write(obj.line);
      console.log(`${obj.image} | ${obj.line}`);
    }
    cb()
  });

  opts.events = allContainers(opts);

  var loghose = logFactory(opts);
  loghose.pipe(filter, {end: false});

  // destroy out if loghose is destroyed
  eos(loghose, function() {
    noRestart();
    Object.values(outStreams).forEach((out) => out.destroy());
  });

  return loghose;
}

function cli() {
  var argv = minimist(process.argv.slice(2), {
    alias: {
      'accessKeyId': 'a',
      'secretAccessKey': 's',
      'region': 'r',
      'logGroupName': 'g',
      'bulkIndex': 'b',
      'timeout': 'o'
    },
    default: {
      b: 1,
    }
  });

  if (!(argv.accesskey || argv.secretkey || argv.groupname || argv.region)) {
    console.log('Usage: docker-cloudwatch [-a ACCESS_KEY] [-s SECRET_KEY]\n' +
                '                         [-r REGION] [-g GROUP_NAME]\n' +
                '                         [-b BULK_INDEX] [-o TIMEOUT]');
    process.exit(1);
  }

  start(argv);
}

module.exports = start;

if (require.main === module) {
  cli();
}
