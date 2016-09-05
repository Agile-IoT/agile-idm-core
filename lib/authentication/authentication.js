//var IDMHttpClient = require('agile-idm-client').http;
var IDMHttpClient = require('agile-idm-client').http;

var Auth = function (conf) {
  if(conf.hasOwnProperty("authentication") && conf["authentication"].hasOwnProperty("web-server")){
     this.idmHttpClient = new IDMHttpClient(conf);
  }
  else {
    console.warn("Authentication module not properly configured!"+JSON.stringify(conf));
    //throw new Error("Authentication module not properly configured!");
  }
};

/*
  * the credentials field is mandatory (token). auth_type and principal are ignored currently.
  * for now this function is just used to authenticate users from tokens
  * depending on the configuration of this module, validation could be done against:
  *     1. sqlite3 database 2. an agile-idm web server or (in the future...) 3. external IdPs (in this case the auth_type is mandatory)
   the response provided in the callback should contain (in data):
	* user_id
	* auth_type
  * scope
*/
// THIS IS THE METHOD THAT SHOULD BE CALLED FROM THE OUTSIDE!!!
Auth.prototype.authenticateEntityPromisse = function (credentials) {
      var promisse = new Promise(function (resolve, reject){
         var auth = this.idmHttpClient.authenticateEntityPromisse(credentials);
         auth.then(function(data){
           //TODO add time validation here... or does it happen on the server side?
            var result = {"user_id": data["user_id"], "auth_type":data["auth_type"], "scope": data["scope"]}
            resolve(result);
         }).catch(function(error){
            console.log('auth wrong '+error);
            reject(error);
        });

      }.bind(this));
      return promisse;
  }



module.exports = Auth;
