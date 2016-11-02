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


//kind is either "update" or "delete"
function changeEntityThroughApi(token,  entity_id, entity_type, entity, that, kind){
  console.log('api: creating promise for for "+kind+" entity');
  return new Promise(function (resolve, reject) {
      var auth_result;
      var storageresult;
      that.authentication.authenticateEntityPromise(token).then(function (authenticationresult) {
          console.log('api: authentication went well');
          auth_result = authenticationresult;
          return that.storage.readEntity(entity_id, entity_type)
      }).then(function (storresult) {
          console.log('api: entity found for update');
          storageresult = storresult;
          return that.pdp.canWrite(auth_result,storageresult);
      }).then(function(){
          console.log('api: pdp for update ok');
          if(kind == "update")
             return that.storage.updateEntity(entity_id, entity_type, entity);
          else if(kind == "delete")
             return that.storage.deleteEntity(entity_id, entity_type);
          else throw createError(500, "programming issue, wrong write action "+kind+" in the changeEntityThroughApi call");
      }).then(function handleResolve(data){
          resolve(data);
          },function handleReject(error){//catch all rejections here we can't recover from any of them
             console.log('error status code '+(error.statusCode)+' error message: '+error.message);
             reject(error);
      });
  });
}

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
          return that.storage.readEntity(entity_id, entity_type)
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
}



  Api.prototype.listEntitiesByAttributeValueAndType = function (token,attribute_type, attribute_value) {
    console.log('api: creating promise for searching entities based on attribute and type');
    var that = this;
    return new Promise(function (resolve, reject) {
        var auth_result;
        var storageresult;
        that.authentication.authenticateEntityPromise(token).then(function (authenticationresult) {
            console.log("api:  authentication went well ");
            auth_result = authenticationresult;
            return that.storage.listEntitiesByAttributeValueAndType(attribute_type, attribute_value);
        }).then(function handleResolve(storresult) {
                console.log("api:  entity found ");
                storageresult = storresult;
                console.log("that.pdp.canReadArray"+that.pdp.canReadArray)
                return that.pdp.canReadArray(auth_result,storageresult);
        }).then(function(subset){
                resolve(subset);
            },function handleReject(error){//catch all rejections here we can't recover from any of them
               console.log('error status code '+(error.statusCode)+' error message: '+error.message);
               reject(error);
        });
    });
}

Api.prototype.updateEntity = function (token,  entity_id, entity_type, entity) {
   var that = this;
   return changeEntityThroughApi(token,  entity_id, entity_type, entity, that, "update");
};

Api.prototype.deleteEntity = function (token, entity_id, entity_type,  entity) {
   var that = this;
   return changeEntityThroughApi(token,  entity_id, entity_type, entity, that, "delete");
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
