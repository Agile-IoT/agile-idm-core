var log = null;

function getLog() {
        if (log) {
            return log;
        } else {
            log = {
              log: function(string){
                //change this...
                //console.log("log info: "+string);
              },
              debug: function(string){
                //change this...
                //console.log("debug info: "+string);
              },
            };
            return log;
        }
}
module.exports = getLog();
