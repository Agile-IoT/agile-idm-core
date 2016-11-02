const createError = require('http-errors');
var IDMHttpClient = require('agile-idm-client').http;

var Auth = function (conf) {
  if (conf.hasOwnProperty("authentication") && conf["authentication"].hasOwnProperty("web-server")) {
    this.idmHttpClient = new IDMHttpClient(conf);
  } else {
    throw createError(500, "Authentication module not properly configured!");
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
Auth.prototype.authenticateEntityPromise = function (credentials) {
  var that = this;
  return new Promise(function (resolve, reject) {
    that.idmHttpClient.authenticateEntityPromisse(credentials).then(function (data) {
      var result = {
        "user_id": data["user_id"],
        "auth_type": data["auth_type"],
        "scope": data["scope"]
      };
      resolve(result);
    }, function (r) {
      reject(r);
    })
  });
};

module.exports = Auth;
