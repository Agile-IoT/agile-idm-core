//TODO Thilo update here and put sqlite3 storage
var Storage	 = require('./lib/storage/storage');
var Validator = require('./lib/validation/validator');
var Authentication = require('./lib/authentication/authentication');
var clone = require('clone');


var Api = function (conf) {
	  	  this.authentication = new Authentication(conf);
   	    this.validator = new Validator(conf);
				this.storage = new Storage(conf);

};

//username can be empty if an oauth2 token is provided... it is just there to ensure that if we ever need usernames, they are already propagated...
Api.prototype.actionPromisse = function (token, action , entity_type , entity_id, entity) {
   var promisse = new Promise(function(resolve, reject) {

        var auth = this.authentication.authenticateEntityPromisse(token);
        auth.then(function(authenticationresult){

						  var val = this.validator.validatePromisse(entity_type, entity);
							val.then(function(validationresult){

								    var finalEntity = clone(entity);
										finalEntity["owner"] = authenticationresult;
										var stor = this.storage.storageOperation( entity_id, entity_type ,action , finalEntity);
										stor.then(function(storageresult){

											   resolve(storageresult);
										}.bind(this)).catch(function(storageerror){
											  reject(storageerror);
										}.bind(this));


							}.bind(this)).catch(function(validationerror){
									reject(validationerror)
							}.bind(this));

        }.bind(this)).catch(function(error){
             reject(error);
        }.bind(this));

   }.bind(this));
   return promisse;
}


module.exports = Api;
