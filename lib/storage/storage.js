var connectionPoolPromisse = require('./entity-connection-pool');
var createError = require('http-errors');
var console = require('../log.js');

var Storage = function (conf) {
  if (conf.hasOwnProperty("storage") && conf.storage.hasOwnProperty("dbName")) {
    this.conf = conf;
  } else {
    throw createError(500, "Storage module not properly configured!");
  }
};
//TODO

function handleFail(reject, error){
  console.log("error in storage module "+error);
  reject(createError(500, "unexpected database error "+error));
  //throw createError(500, "unexpected database error "+error);
}
//Maybe just proxy calls to the sqlite3 module somehow??????????????????? to have only crud api instead of ugly operation with read update delete as a param

Storage.prototype.createEntity = function (entity_id, entity_type, owner, data) {
  //console.log("creating promise ...")
  var conf = this.conf;
  var promise = new Promise(function (resolve, reject) {
    connectionPoolPromisse(conf).then(function (storage) {
      storage.createEntityPromise(entity_id, entity_type, owner, data).then(resolve, reject);
    }, handleFail.bind(this,reject));
  });
  return promise;
};

Storage.prototype.readEntity = function (entity_id, entity_type) {
  var conf = this.conf;
  var promise = new Promise(function (resolve, reject) {
    connectionPoolPromisse(conf).then(function (storage) {
      storage.readEntityPromise(entity_id, entity_type).then(resolve, reject);
    },handleFail.bind(this,reject));
  });
  return promise;
};

Storage.prototype.updateEntity = function (entity_id, entity_type, data) {
  var conf = this.conf;
  var promise = new Promise(function (resolve, reject) {
    connectionPoolPromisse(conf).then(function (storage) {
      storage.updateEntityPromise(entity_id, entity_type, data).then(resolve, reject);
    },handleFail.bind(this,reject));
  });
  return promise;
};

Storage.prototype.deleteEntity = function (entity_id, entity_type, data) {
  var conf = this.conf;
  var promise = new Promise(function (resolve, reject) {
    connectionPoolPromisse(conf).then(function (storage) {
      storage.deleteEntityPromise(entity_id, entity_type).then(resolve, reject);
    },handleFail.bind(this,reject));
  });
  return promise;
};

Storage.prototype.listEntitiesByAttributeValueAndType = function (attribute_type, attribute_value) {
  var conf = this.conf;
  var promise = new Promise(function (resolve, reject) {
    connectionPoolPromisse(conf).then(function (storage) {
      //console.log(attribute_type + attribute_value +''+storage.listEntitiesByAttributeValueAndType)
      storage.listEntitiesByAttributeValueAndType(attribute_type, attribute_value).then(resolve, reject);
    },handleFail.bind(this,reject));
  });
  return promise;
};

Storage.prototype.setConnectionMockup = function (conn) {
  connectionPoolPromisse = conn;
};

module.exports = Storage;
