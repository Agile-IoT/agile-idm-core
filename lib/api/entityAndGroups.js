var Storage = require('../storage/storage');
var Validator = require('../validation/validator');
var Authentication = require('../authentication/authentication');

var Api = function (conf) {
    this.authentication = new Authentication(conf);
    this.validator = new Validator(conf);
    this.storage = new Storage(conf);
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
            //return that.storage.doesEntityNotExistCheck(entity_id, entity_type, entity);
        }).then(function(){
             return that.storage.storageOperation(entity_id, entity_type, action, entity)
        }).then(function handleResolve(storageresult) {
                resolve(storageresult);
            },function handleReject(error){//catch all rejections here we can't recover from any of them
               console.log('error status code '+(error.statusCode)+' error message: '+error.message);
        });
    });
    return p;
};

Api.prototype.createEntity = function (token, entity_type, entity_id, entity) {
  return this.actionPromisse((token,"create", entity_type, entity_id, entity));
};

Api.prototype.readEntity = function (token, entity_type, entity_id, entity) {
    return this.actionPromisse((token,"read", entity_type, entity_id, entity));
};

Api.prototype.updateEntity = function (token, entity_type, entity_id, entity) {
    return this.actionPromisse((token,"update", entity_type, entity_id, entity));
};

Api.prototype.deleteEntity = function (token, entity_type, entity_id, entity) {
    return this.actionPromisse((token,"delete", entity_type, entity_id, entity));
};

Api.prototype.setMocks = function(auth,val,store){
  this.authentication = auth;
  this.validator = val;
  this.storage = store;
}
module.exports = Api;
