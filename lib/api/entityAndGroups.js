var Storage = require('../storage/storage');
var Validator = require('../validation/validator');
var Authentication = require('../authentication/authentication');

var Api = function (conf) {
    this.authentication = new Authentication(conf);
    this.validator = new Validator(conf);
    this.storage = new Storage(conf);
};

var entityNotExistCheck = this.storage.doesEntityNotExistCheck();

/**
 * This can only be used for adding, as it's rejects once the entity already exists,
 * which is the case for read, update and delete.
 * TODO Juan David Maybe remove this method?
 */
Api.prototype.actionPromisse = function (token, action, entity_type, entity_id, entity) {
    return new Promise(function (resolve, reject) {
        var auth_result;
        this.authentication.authenticateEntityPromisse(token).then(function (authenticationresult) {
            auth_result = authenticationresult;
            return this.validator.validatePromisse(entity_type, entity);
        }).then(function () {
            entity["owner"] = auth_result["user_id"] + "!@!" + auth_result["auth_type"];
            return entityNotExistCheck(entity_id, entity_type, entity);
        }).then(this.storage.storageOperation(entity_id, entity_type, action, entity))
            .then(function (storageresult) {
                resolve(storageresult);
            }).catch(function (err) {
            reject(err);
        });
    });
};

Api.prototype.createEntity = function (token, entity_type, entity_id, entity) {
    return new Promise(function (resolve, reject) {
        var auth_result;
        this.authenticateEntityPromisse(token).then(function (result) {
            auth_result = result;
            return this.validator.validatePromisse(entity_type, entity);
        }).then(function () {
            entity["owner"] = auth_result["user_id"] + "!@!" + auth_result["auth_type"];
            return entityNotExistCheck(entity_id, entity_type, entity);
        }).then(this.storage.prototype.createEntity(entity_id, entity_type, entity))
            .then(function (result) {
                resolve(result);
            }).catch(function (err) {
            reject(err);
        });
    });
};

Api.prototype.readEntity = function (token, entity_type, entity_id, entity) {
    return new Promise(function (resolve, reject) {
        this.authenticateEntityPromisse(token)
            .then(this.storage.prototype.readEntity(entity_id, entity_type, entity))
            .then(function (result) {
                resolve(result);
            }).catch(function (err) {
            reject(err);
        });
    });
};

Api.prototype.updateEntity = function (token, entity_type, entity_id, entity) {
    return new Promise(function (resolve, reject) {
        this.authenticateEntityPromisse(token)
            .then(this.validator.validatePromisse(entity_type, entity))
            .then(this.storage.readEntity(entity_id, entity_type, entity))
            .then(this.storage.updateEntity(entity_id, entity_type, entity))
            .then(function (result) {
                resolve(result);
            }).catch(function (err) {
                reject(err);
        })
    });
};

Api.prototype.deleteEntity = function (token, entity_type, entity_id, entity) {
    return new Promise(function (resolve, reject) {
        this.authenticateEntityPromisse(token)
            .then(this.storage.readEntity(entity_id, entity_type, entity))
            .then(this.storage.prototype.deleteEntity(entity_id, entity_type, entity))
            .then(function (result) {
                resolve(result);
            }).catch(function (err) {
            reject(err);
        });
    });
};

module.exports = Api;
