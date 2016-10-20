const createError = require('http-errors');

var Pdp = function (conf) {
    /*if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
        this.conf = conf;
    } else {
        throw createError(500, "Storage module not properly configured!");
    }*/
};

//TODO consider getting info (objects) or Ids also in the same argument... may be easier to call?
 Pdp.prototype.canRead = function (userInfo, entityInfo) {
       return  new Promise(function (resolve, reject){
            if(1 ==1)
              resolve();
            else
                reject(createError(403,"user unauthorized for the action for entity :"+JSON.stringify(entityInfo)));

       })
 }

 Pdp.prototype.canWrite = function (userInfo, entityInfo) {
       return  new Promise(function (resolve, reject){
           if(true)
            resolve();
           else
             reject(createError(403,"user unauthorized for the action for entity :"+JSON.stringify(entityInfo)));
           
       })
 }


module.exports = Pdp;
