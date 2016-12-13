var Pap = require('./pap');
var createError = require('http-errors');
var console = require('../log');
var pep = require('UPFROnt').pep;
var clone = require('clone');



var Pep = function (conf) {
  console.log("intializing Pep: ");
  this.conf = conf;
  this.pap = new Pap(conf);
  /*if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
      this.conf = conf;
  } else {
      throw createError(500, "Storage module not properly configured!");
  }*/
};

//TODO this function needs to resolve regardless of whether the call is performed with an entity or a group as the second argment.
Pep.prototype.declassify = function (userInfo, entityInfo) {
  var that = this;
  console.log("arguments for canRead "+JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {

    console.log("checking whether user with id "+userInfo.id+ " can read entity "+JSON.stringify(entityInfo));
    var ps = [that.pap.getEntityPolicyRecord(entityInfo.id, entityInfo.type),
    that.pap.getAttributePolicy(userInfo.id, userInfo.type)];
    Promise.all(ps)
      .then(function(policies){
          var userInfoPolicy = policies[0];
          console.log("calling Pep to declassify  entity with id "+entityInfo.id+" for user  "+userInfo.id);
          console.log("arguments: ");
          console.log("             "+JSON.stringify(entityInfo));
          console.log("             "+JSON.stringify(policies[0]));
          console.log("             "+JSON.stringify(userInfo));
          console.log("             "+JSON.stringify(policies[1]));
          return pep.declassify(entityInfo, policies[0], userInfo, policies[1]);
      }).then(function(filteredObject) {
             resolve(filteredObject);
      },reject);


  });
};

module.exports = Pep;
