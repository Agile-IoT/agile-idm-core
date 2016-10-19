var connectionPoolPromisse = require('./entity-connection-pool');

var Storage = function (conf) {
    if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
        this.conf = conf;
    } else {
        console.warn("Authentication module not properly configured!" + JSON.stringify(conf));
        //throw new Error("Authentication module not properly configured!");
    }
};

/**
 * Action must be one of 'create', 'read', 'update' or 'delete'.
 */
Storage.prototype.storageOperation = function (id, entity_type, action, data) {
    return new Promise(function (resolve, reject) {
        connectionPoolPromisse(this.conf).then(function (storage) {
            storage.crudOperation(id, entity_type, action, data).then(function (result) {
                if (result.hasOwnProperty("success") && result.success) {
                    resolve(result.data);
                } else {
                    reject(new Error(result.hasOwnProperty("error") ? result.error : "unexpected storage error"));
                }
            });
        });
    });
};

Storage.prototype.createEntity = function (id, entity_type, data) {
    return this.prototype.crudOperation(id, entity_type, 'create', data);
};

Storage.prototype.readEntity = function (id, entity_type, data) {
    return this.prototype.crudOperation(id, entity_type, 'read', data);
};

Storage.prototype.updateEntity = function (id, entity_type, data) {
    return this.prototype.crudOperation(id, entity_type, 'update', data);
};

Storage.prototype.deleteEntity = function (id, entity_type, data) {
    return this.prototype.crudOperation(id, entity_type, 'delete', data);
};




/**
 * Returns a resolved Promise when the entity is NOT found.
 * Returns a rejected Promise when the entity is found.
 *
 * @returns {Promise} whether the given entity already exists or not.
 */
Storage.prototype.doesEntityNotExistCheck = function (id, entity_type, data) {
    return new Promise(function (resolve, reject) {
        this.prototype.storageOperation(id, entity_type, 'read', data).then(function () {
            console.log("entity found: " + JSON.stringify(storageresult));
            reject(new Error("Entity exists already."));
        }).catch(function () {
            resolve();
        });
    });
};

module.exports = Storage;
