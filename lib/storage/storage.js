var  connectionPoolPromisse	 = require('./entity-connection-pool');
var configuration = null;

var Storage = function (conf) {
  if(conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")){
    this.conf = conf;
  }
  else {
    console.warn("Authentication module not properly configured!"+JSON.stringify(conf));
    //throw new Error("Authentication module not properly configured!");
  }
};

//action must be 	one of read create update delete
Storage.prototype.storageOperation = function (id, entity_type ,action , data) {
      var promisse = new Promise(function (resolve, reject){
        connectionPoolPromisse(this.conf).then(function(storage){
           storage.crudOperation(id , entity_type ,action , data, function(result){
               if(result.hasOwnProperty("success") && result.success){
                 if(result.hasOwnProperty("data"))
                   return resolve(data);
                else
                  return resolve();
               }
               else{
                 if(result.hasOwnProperty("error"))
                  return reject(new Error(result.error));
                else
                  return reject(new Error("unexpected storage error"));
               }
           });

        }).catch(function(error){
              console.log('cannot load database error'+JSON.stringify(error));
        });

      }.bind(this));
      return promisse;
  }



module.exports = Storage;
