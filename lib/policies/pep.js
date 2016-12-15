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
  console.log("arguments for declassify " + JSON.stringify(arguments));

  var that = this;
  //entityInfo.type = entityInfo.type.substring(1);
  //userInfo.type = userInfo.type.substring(1);
  console.log("arguments for canRead " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    //TODO remove this once the proper policy declassification has been tested and integrated
    var groups = entityInfo.groups;
    console.log("checking whether user with id " + userInfo.id + " can read entity " + JSON.stringify(entityInfo));
    var ps = [that.pap.getEntityPolicyRecord(entityInfo.id, entityInfo.type),
      that.pap.getAttributePolicy(userInfo.id, userInfo.type)
    ];
    Promise.all(ps)
      .then(function (policies) {
        var userInfoPolicy = policies[0];
        console.log("calling Pep to declassify  entity with id " + entityInfo.id + " for user  " + userInfo.id);
        console.log("arguments: ");
        console.log("             " + JSON.stringify(entityInfo));
        console.log("             " + JSON.stringify(policies[0]));
        console.log("             " + JSON.stringify(userInfo));
        console.log("             " + JSON.stringify(policies[1]));
        return pep.declassify(clone(entityInfo), policies[0], {
          "type": userInfo.type.substring(1),
          "data": userInfo
        }, policies[1]);
      }).then(function (filteredObject) {
        if (groups)
          filteredObject.groups = groups;
        resolve(filteredObject);
      }, reject);

  });
};

Pep.prototype.declassifyArray = function (userInfo, entitiesArray) {
  var promises = [];
  var that = this;
  return new Promise(function (resolve, reject) {
    for (var i in entitiesArray)
      promises.push(that.declassify(userInfo, entitiesArray[i]));
    Promise.all(promises).then(function (entitiesResult) {
      resolve(entitiesResult);
    }, function (cause) {
      reject(cause);
    });
  });
};

module.exports = Pep;
