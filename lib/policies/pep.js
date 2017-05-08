var Pap = require('./pap');
var Pdp = require('./pdp');
var createError = require('http-errors');
var console = require('../log');
var pep = require('UPFROnt').pep;
var clone = require('clone');

var Pep = function (conf) {
  console.log("intializing Pep: ");
  this.conf = conf;
  this.pap = new Pap(conf);
  this.pdp = new Pdp(conf);
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
    //no longer needed since we are checking for groups access using regular policies in the declassify function
    //var groups = entityInfo.groups;
    //delete entityInfo.groups;
    var ps = [];
    var names = []

    function relaxPDPPromise(p) {
      return new Promise(function (resolve, reject) {
        p.then(function (r) {
          console.log("PDP result! "+JSON.stringify(r));
            resolve(true);
        }).catch(function (error) {
          resolve(false);
        })
      });
    }

    Object.keys(entityInfo).forEach(function (v) {
      ps.push(relaxPDPPromise(that.pdp.canReadEntityAttribute(userInfo, entityInfo, v)));
      names.push(v);
    });

    Promise.all(ps).then(function (results) {
      var ob = {};
      console.log("all names received" + JSON.stringify(names));
      console.log("all decisions received" + JSON.stringify(results));
      for (var i = 0; i < names.length; i++) {
        if (results[i]) {
          ob[names[i]] = entityInfo[names[i]];
        }
      }
      resolve(ob);
    });
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
