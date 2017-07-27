var clone = require('clone');
var upfront = require('UPFROnt');
var pap = upfront.pap;
var policyDB = null;
var console = require('../log.js');
var db;
var fs = require('fs');

function loadDb(that) {

}

function serializeId(entity_id, entity_type) {
  return entity_id + "###" + entity_type;
  //return entity_id;
}

var Pap = function (conf) {
  this.conf = conf;
  var that = this;
  console.log(`config: ${JSON.stringify(conf)}`);
  upfront.init(conf.upfront).then(function () {
    console.log("pap, it is initialized");
  }).catch(function (error) {
    console.log("error initializing the pap: " + error);
    console.log(error.stack);
  });
  /*if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
      this.conf = conf;
  } else {
      throw createError(500, "Storage module not properly configured!");
  }*/
};

//export serializeId
Pap.prototype.serializeId = serializeId;

Pap.prototype.getEntityPolicyRecord = function (entity_id, entity_type) {
  var that = this;
  var id = serializeId(entity_id, entity_type);
  console.log("pap: getting fullrecord for Policy id: " + id);
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return pap.getFullRecord(id);
    }).then(function (data) {
      resolve(data);
    }).catch(reject);
  });

};

Pap.prototype.setDefaultEntityPolicies = function (entity_id, entity_type) {
  var that = this;
  var id = serializeId(entity_id, entity_type);
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return pap.set(id, that.conf.policies.create_entity_policy);
    }).then(function (result) {
      console.log("setting top level policy for id " + id + " policy " + JSON.stringify(that.conf.policies.top_level_policy));
      return pap.set(id, "", that.conf.policies.top_level_policy);
    }).then(function (result) {
      var p_entity_type = entity_type.substring(1);
      console.log("looking for entity type " + p_entity_type);
      var setting = [];
      //set default policy to additiona attributes shown by id sometimes (groups and entities)
      //if in the end the user sets a more restrictive policy afterwards, this will be overwritten
      //TODO at some point check trick in the pep to go arround the declassification of groups (array of objects, maybe it is not supported yet by the policy framework)
      setting.push(function () {
        return pap.set(id, "groups", that.conf.policies.top_level_policy);
      });
      setting.push(function () {
        return pap.set(id, "entities", that.conf.policies.top_level_policy);
      });
      if (that.conf.policies.attribute_level_policies.hasOwnProperty(p_entity_type)) {
        Object.keys(that.conf.policies.attribute_level_policies[p_entity_type]).forEach(function (k) {
          console.log('calling set prop with id ' + id + " attribute value: " + k + " policy: " + JSON.stringify(that.conf.policies.attribute_level_policies[p_entity_type][k]));
          setting.push(function () {
            return pap.set(id, k, that.conf.policies.attribute_level_policies[p_entity_type][k]);
          });
        });
        var values = [];
        if (setting.length <= 0) {
          resolve();
        } else {
          var ps = setting.reduce(function (p, n) {
            return p.then(function (v) {
              console.log("calling promise sequentially... ");
              if (v)
                values.push(v);
              return n();
            });
          }, setting[0]());
          ps.then(function () {
            console.log("resolving after executing sequential gets results: " + JSON.stringify(values));
            return resolve();
          });
        }
      } else {
        resolve();
      }
    }).catch(function err(reason) {
      console.log(reason);
      reject(reason);
    });
  });
};

// attribute can be undefined, then it fetches the policy for the root of the object
Pap.prototype.getAttributePolicy = function (entity_id, entity_type, attribute) {
  var that = this;
  var id = serializeId(entity_id, entity_type);
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      var p;
      if (attribute)
        p = pap.get(id, attribute);
      else
        p = pap.get(id, "");
      return p;
    }).then(function (policy) {
      if (attribute)
        console.log("found attribute policy for attribute " + attribute + " and  id " + id + " policy " + JSON.stringify(policy));
      else
        console.log("found top policy for id " + id + " policy " + JSON.stringify(policy));
      resolve(policy);
    }, reject);
  });
};

Pap.prototype.getEntityPolicies = function (entity_id, entity_type) {
  var that = this;
  var id = serializeId(entity_id, entity_type);
  return new Promise(function (resolve, reject) {
    upfront.init(that.conf.upfront).then(function () {
      return pap.getFullRecord(id);
    }).then(function (policies) {
      console.log("found policy for id " + id + " policy " + JSON.stringify(policies));
      resolve(policies);
    }, reject);
  });
};

Pap.prototype.setEntityPolicy = function (entity_id, entity_type, property, policy) {
  var that = this;
  return new Promise(function (resolve, reject) {
    var id = serializeId(entity_id, entity_type);
    upfront.init(that.conf.upfront).then(function () {
      return pap.set(id, property, policy);
    }).then(function (currentState) {
      console.log("set policy for id " + id + " policy " + JSON.stringify(policy));
      resolve(currentState);
    }, reject);
  });
};

Pap.prototype.deleteEntityPolicy = function (entity_id, entity_type, property) {
  var that = this;
  return new Promise(function (resolve, reject) {
    var id = serializeId(entity_id, entity_type);
    upfront.init(that.conf.upfront).then(function () {
      return pap.del(id, property);
    }).then(function (currentState) {
      console.log("set policy for id " + id + " policy " + JSON.stringify(property));
      resolve(currentState);
    }, reject);
  });
};

module.exports = Pap;
