var db = null;
var EntityStorage = require('./sqlite3-storage');
//This module just exposes one single instance of sqlite everywhere...

function loadDb(conf,resolve,reject){

      var promise  = new Promise(function (resolve, reject){

        if(db){
          return resolve(db);
        }
        else if(!conf.hasOwnProperty('storage')){
          console.log(" cannot find storage configuration in Entity Storage");
          reject(new Error("error: cannot find storage configuration in Entity Storage"));
        }
        else{
          db = new EntityStorage();
          db.init(conf['storage'], function(result){
               if(result.success){
                   return resolve(db);
               }
               else{
                  console.log("unknown error");
                   reject(new Error("error:"+result.error));
               }
           });
        }
    });
    return promise;
}
module.exports = loadDb;
