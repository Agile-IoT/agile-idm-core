var db;
var EntityStorage = require('./level-storage');
//var console = require('./log');

function loadDb(conf) {
  return new Promise(function (resolve, reject) {
    console.log("conf: " + JSON.stringify(conf));
    if (conf === "disconnect") {
      console.log("closing database object");
      if (db)
        db.close().then(function () {
          db = null;
          console.log("database cleaned");
          return resolve();
        });
      else {
        return resolve();
      }
    } else if (db) {
      console.log("resolving with previous database instance");
      return resolve(db);
    } else if (!conf.hasOwnProperty('storage')) {
      console.log(" cannot find storage configuration in Entity Storage");
      reject(new Error("error: cannot find storage configuration in Entity Storage"));
    } else {
      db = new EntityStorage();
      console.log("init new database instance");
      db.init(conf.storage, function (result) {
        console.log("resolving with new database instance");
        return resolve(db);

      });
    }
  });
}
module.exports = loadDb;
