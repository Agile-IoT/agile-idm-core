var log = null;
var silent = true;

function getLog() {
  if (log) {
    return log;
  } else {
    log = {
      log: function (string) {
        if (!silent)
          console.log("log info: " + string);
      },
      debug: function (string) {
        if (!silent)
          console.log("debug info: " + string);
      },
    };
    return log;
  }
}
module.exports = getLog();
