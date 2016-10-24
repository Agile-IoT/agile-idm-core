var Storage = require('../storage/storage');
var Pdp = require('../pdp/pdp');
var Validator = require('../validation/validator');
var Authentication = require('../authentication/authentication');
const console = require('../log.js');

var Api = function (conf) {
    this.authentication = new Authentication(conf);
    this.validator = new Validator(conf);
    this.storage = new Storage(conf);
    this.pdp = new Pdp();
};



/**
 * This can only be used for adding, as it's rejects once the entity already exists,
 * which is the case for read, update and delete.
 * TODO Juan David Maybe remove this method?
 */
Api.prototype.actionPromisse = function (token, action, entity_type, entity_id, entity) {
    var that = this;
    var p = new Promise(function (resolve, reject) {
        var auth_result;
        that.authentication.authenticateEntityPromise(token).then(function (authenticationresult) {
            auth_result = authenticationresult;
            return that.validator.validatePromise(entity_type, entity);
        }).then(function () {
            entity["owner"] = auth_result["user_id"] + "!@!" + auth_result["auth_type"];
            //return that.pdp.canRead(auth_result,entity);
        }).then(function(){
             return that.storage.storageOperation(entity_id, entity_type, owner, entity)
        }).then(function handleResolve(storageresult) {
                resolve(storageresult);
            },function handleReject(error){//catch all rejections here we can't recover from any of them
               console.log('error status code '+(error.statusCode)+' error message: '+error.message);
               reject(error);
        });
    });
    return p;
};

Api.prototype.createEntity = function (token,  entity_id, entity_type, entity) {
  console.log('api: creating promise for creation of entity');
  var that = this;
  var p = new Promise(function (resolve, reject) {
      var auth_result;
      var owner;
      that.authentication.authenticateEntityPromise(token).then(function (authenticationresult) {
          console.log("api:  authentication went well ");
          auth_result = authenticationresult;
          return that.validator.validatePromise(entity_type, entity);
      }).then(function () {
          console.log("api:  validation passed");
          owner = auth_result["user_id"] + "!@!" + auth_result["auth_type"];
          //return that.storage.doesEntityNotExistCheck(entity_id, entity_type, entity);
      }).then(function(d){

           console.log("api: creating entity with id "+ entity_id +" and with type "+entity_type+" and with owner "+ owner+ "and with attributes "+ JSON.stringify(entity));
           return that.storage.createEntity(entity_id, entity_type, owner, entity);
      }).then(function handleResolve(storageresult) {
              console.log("api:  entity created");
              resolve(storageresult);
          },function handleReject(error){//catch all rejections here we can't recover from any of them
             console.log('error status code '+(error.statusCode)+' error message: '+error.message);
             reject(error);
      });
  });
  return p;
};

Api.prototype.readEntity = function (token, entity_id, entity_type) {
  console.log('api: creating promise for reading entity');
  var that = this;
  return new Promise(function (resolve, reject) {
      var auth_result;
      var storageresult;
      that.authentication.authenticateEntityPromise(token).then(function (authenticationresult) {
          console.log("api:  authentication went well ");
          auth_result = authenticationresult;
          try{
          return that.storage.readEntity(entity_id, entity_type)
        }catch(e){
          console.log(e)
        }
      }).then(function handleResolve(storresult) {
              console.log("api:  entity found ");
              storageresult = storresult;
              return that.pdp.canRead(auth_result,storageresult);
      }).then(function(){
              resolve(storageresult);
          },function handleReject(error){//catch all rejections here we can't recover from any of them
             console.log('error status code '+(error.statusCode)+' error message: '+error.message);
             reject(error);
      });
  });
};

Api.prototype.updateEntity = function (token,  entity_id, entity_type, entity) {
  var that = this;
  return new Promise(function (resolve, reject) {
      var auth_result;
      var storageresult;
      that.authentication.authenticateEntityPromise(token).then(function (authenticationresult) {
          auth_result = authenticationresult;
          return that.storage.readEntity(entity_id, entity_type)
      }).then(function (storresult) {
              storageresult = storresult;
              return that.pdp.canWrite(auth_result,storageresult);
      }).then(function(){
              return that.storage.updateEntity(entity_id, entity_type,entity);
      }).then(function handleResolve(data){
              resolve(data);
          },function handleReject(error){//catch all rejections here we can't recover from any of them
             console.log('error status code '+(error.statusCode)+' error message: '+error.message);
             reject(error);
      });
  });
};

Api.prototype.deleteEntity = function (token, entity_id, entity_type,  entity) {
    return this.actionPromisse((token,"delete", entity_type, entity_id, entity));
};


//NOTE this functiones are just used for testing
Api.prototype.setMocks = function(auth,val,store,pdp,storeconn){
  if(auth)
     this.authentication = auth;
  if(val)
     this.validator = val;
  if(store)
     this.storage = store;
  if(storeconn)
     this.storage.setConnectionMockup(storeconn);
  if(pdp)
    this.pdp = pdp;
}
module.exports = Api;
