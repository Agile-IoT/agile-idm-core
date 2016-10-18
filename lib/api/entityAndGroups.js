var Storage	 = require('../storage/storage');
var Validator = require('../validation/validator');
var Authentication = require('../authentication/authentication');
var clone = require('clone');


var Api = function (conf) {
	  	  this.authentication = new Authentication(conf);
   	    this.validator = new Validator(conf);
				this.storage = new Storage(conf);
};

/*
   This promisse is used to create entities
*/
Api.prototype.actionPromisse = function (token, action , entity_type , entity_id, entity) {
   var promisse = new Promise(function(resolve, reject) {

        var auth = this.authentication.authenticateEntityPromisse(token);
        auth.then(function(authenticationresult){

						  var val = this.validator.validatePromisse(entity_type, entity);
							val.then(function(validationresult){

								    var finalEntity = clone(entity);
										finalEntity["owner"] = authenticationresult;
										var read = this.storage.storageOperation( entity_id, entity_type ,action, finalEntity);

										read.then(function(storageresult){
											   console.log("entity found: "+JSON.stringify(storageresult));
												 var stor = this.storage.storageOperation( entity_id, entity_type ,action , finalEntity);

		 										 stor.then(function(storageresult){
		 											   resolve(storageresult);
		 										 }.bind(this)).catch(function(storageerror){
		 											  reject(storageerror);
		 										 }.bind(this));

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
