var connectionPoolPromisse = require('./entity-connection-pool');
const createError = require('http-errors');

var Storage = function (conf) {
    if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
        this.conf = conf;
    } else {
        throw createError(500, "Storage module not properly configured!");
    }
};

/**
 * Action must be one of 'create', 'read', 'update' or 'delete'.
 */
 Storage.prototype.storageOperation = function (id, entity_type ,action , data) {
       var promise = new Promise(function (resolve, reject){
         connectionPoolPromisse(this.conf).then(function(storage){
            storage.crudOperation(id , entity_type ,action , data, function(result){
                if(result.hasOwnProperty("success") && result.success){
                  resolve(result.data);
                }
                else{
                     if(result.hasOwnProperty("error")){
                       if(result.error.hasOwnProperty("code") && result.error.code == "SQLITE_CONSTRAINT")
                           reject(createError(409, result.error));
                       else
                          reject(createError(400, result.error));
                     }
                     else{
                       reject(createError(500, "unexpected storage error"));
                   }
                }
            });
         })
       }.bind(this));
       return promise;
}

Storage.prototype.createEntity = function (id, entity_type, data) {
    return this.storageOperation(id, entity_type, 'create', data);
};

Storage.prototype.readEntity = function (id, entity_type ) {
    return this.storageOperation(id, entity_type, 'read');
};

Storage.prototype.updateEntity = function (id, entity_type, data) {
    return this.storageOperation(id, entity_type, 'update', data);
};

Storage.prototype.deleteEntity = function (id, entity_type, data) {
    return this.storageOperation(id, entity_type, 'delete', data);
};


module.exports = Storage;
