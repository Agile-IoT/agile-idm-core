var Storage = require('agile-idm-entity-storage').Storage;
var Pdp = require('../policies/pdp.js');
var Pap = require('../policies/pap.js');
var Validator = require('../validation/validator');
var console = require('../log.js');

var Api = function (conf) {

  this.validator = new Validator(conf);
  this.storage = new Storage(conf);
  this.pdp = new Pdp(conf);
  this.pap = new Pap(conf);
  console.log('initializing api');
};

Api.prototype.createEntity = function (auth_result, entity_id, entity_type, entity) {
  console.log('api: creating promise for creation of entity and setting owner to user executing the request');
  var that = this;
  var owner = auth_result.owner;
  return that.createEntityAndSetOwner(auth_result, entity_id, entity_type, entity,owner);
};

Api.prototype.createEntityAndSetOwner = function(auth_result, entity_id, entity_type, entity,owner) {
  console.log('api: creating promise for creation of entity with owner '+owner);
  var that = this;
  var p = new Promise(function (resolve, reject) {
    that.validator.validatePromise(entity_type, entity)
    .then(function () {
      console.log("api:  validation passed");
      return that.pap.setEntityPolicies(entity_id, entity_type);
    }).then(function(){
      console.log("api: checking whether usre can write to all attributes of entity with id " + entity_id + " and with type " + entity_type + " and with owner " + owner + "and with attributes " + JSON.stringify(entity));
      return that.pdp.canWriteToAllAttributes(auth_result, entity, entity_id, entity_type,owner);
    }).then(function(){
      console.log("api: creating entity with id " + entity_id + " and with type " + entity_type + " and with owner " + owner + "and with attributes " + JSON.stringify(entity));
      return that.storage.createEntity(entity_id, entity_type, owner, entity);
    }).then(function handleResolve(storageresult) {
      console.log("api:  entity created");
      resolve(storageresult);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
  return p;
};

Api.prototype.readEntity = function (auth_result, entity_id, entity_type) {
  console.log('api: creating promise for reading entity');
  var that = this;
  return new Promise(function (resolve, reject) {
  var storageresult;
  that.storage.readEntity(entity_id, entity_type)
    .then(function handleResolve(storresult) {
      console.log("api:  entity found ");
      storageresult = storresult;
      return that.pdp.canRead(auth_result, storageresult);
    }).then(function () {
      resolve(storageresult);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
};

Api.prototype.listEntitiesByAttributeValueAndType = function (auth_result, attribute_constraints, entity_type) {
  console.log('api: creating promise for searching entities based on attribute and type');
  var that = this;
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.listEntitiesByAttributeValueAndType( attribute_constraints, entity_type)
    .then(function handleResolve(storresult) {
      console.log("api:  entity found ");
      storageresult = storresult;
      return that.pdp.canReadArray(auth_result, storageresult);
    }).then(function (subset) {
      resolve(subset);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
};
//equivalent of update
Api.prototype.setEntityAttribute = function (auth_result, entity_id, entity_type, attribute_name, attribute_value) {
  var that = this;
  console.log('api: creating promise for for setting attribute for entity '+JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
    .then(function (storresult) {
      console.log('api: entity found for update');
      console.log('api: checking whether user can update attribute');
      storageresult = storresult;
      return that.pdp.canWriteToAttribute(auth_result,storageresult, attribute_name, attribute_value);
    }).then(function () {
      console.log('api: pdp for attribute setting was ok');
      storageresult[attribute_name] = attribute_value;
      return   that.validator.validatePromise(entity_type, storageresult);
    }).then(function(){
      console.log('api:validation for attribute update was ok');
      return that.storage.updateEntity(entity_id, entity_type, storageresult);
    }).then(function handleResolve(data) {
      resolve(data);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });

};

Api.prototype.deleteEntity = function (auth_result, entity_id, entity_type, entity) {
  var that = this;
  console.log('api: creating promise for for entity deletion '+JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readEntity(entity_id, entity_type)
    .then(function (storresult) {
      console.log('api: entity found for update');
      storageresult = storresult;
      return that.pdp.canDelete(auth_result, storageresult);
    }).then(function () {
      console.log('api: pdp for update ok');
      return that.storage.deleteEntity(entity_id, entity_type);
    }).then(function handleResolve(data) {
      resolve(data);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
};


Api.prototype.readGroup = function (auth_result, group_name, owner) {
  console.log('api: creating promise for reading entity');
  var that = this;
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
    .then(function handleResolve(storresult) {
      console.log("api:  group found ");
      storageresult = storresult;
      return that.pdp.canRead(auth_result, storageresult);
    }).then(function () {
      resolve(storageresult);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
};


Api.prototype.createGroup = function (auth_result, group_name) {
  console.log('api: creating promise for creation of group'+JSON.stringify(arguments));
  var that = this;
  var p = new Promise(function (resolve, reject) {
    var owner;
    var storageresult;
    owner = auth_result.owner;
    console.log("api: creating group with name " + group_name + " and owner " + owner);
    that.storage.createGroup(group_name , owner)
    .then(function handleResolve(storageresult) {
      console.log("api:  group created");
      resolve(storageresult);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
  return p;
};


Api.prototype.deleteGroup = function (auth_result, group_name, owner, entity) {
  var that = this;
  console.log('api: creating promise for for group deletion '+JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
    .then(function (storresult) {
      console.log('api: group found for delete');
      storageresult = storresult;
      return that.pdp.canDelete(auth_result, storageresult);
    }).then(function () {
      console.log('api: pdp for delete ok');
      return that.storage.deleteGroup(group_name, owner);
    }).then(function handleResolve() {
      console.log('api: pdp for delete ok');
      resolve();
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
};


Api.prototype.addEntityToGroup = function (auth_result, group_name, owner,entity_id, entity_type) {
  var that = this;
  console.log('api: creating promise for adding entity to group '+JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
    .then(function (storresult) {
      console.log('api: group found for adding an entity to it');
      storageresult = storresult;
      return that.pdp.canUpdate(auth_result, storageresult);
    }).then(function () {
      console.log('api: pdp for updating group   ok');
      return that.storage.addEntityToGroup(group_name, owner,entity_id, entity_type);
    }).then(function handleResolve(entity) {
      console.log('api: pdp add entity to group ok');
      resolve(entity);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
};

Api.prototype.removeEntityFromGroup = function (auth_result, group_name, owner,entity_id, entity_type) {
  var that = this;
  console.log('api: creating promise for removing entity from group '+JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    var storageresult;
    that.storage.readGroup(group_name, owner)
    .then(function (storresult) {
      console.log('api: group found for removing an entity from it');
      storageresult = storresult;
      return that.pdp.canUpdate(auth_result, storageresult);
    }).then(function () {
      console.log('api: pdp for updating group   ok');
      return that.storage.removeEntityFromGroup(group_name, owner,entity_id, entity_type);
    }).then(function handleResolve(entity) {
      console.log('api: pdp remove entity from group ok');
      resolve(entity);
    }, function handleReject(error) { //catch all rejections here we can't recover from any of them
      console.log('error status code ' + (error.statusCode) + ' error message: ' + error.message);
      reject(error);
    });
  });
};

Api.prototype.setStorage = function(storage){
  this.storage = storage;
};
//NOTE this functiones are just used for testing
Api.prototype.setMocks = function (val, store, pdp, storeconn) {

  if (val)
    this.validator = val;
  if (store)
    this.storage = store;
  if (storeconn)
    this.storage.setConnectionMockup(storeconn);
  if (pdp)
    this.pdp = pdp;
};
module.exports = Api;
