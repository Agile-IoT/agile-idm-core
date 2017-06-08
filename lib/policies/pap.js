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
  upfront.init(conf.upfront).then(function () {
    console.log("pap, it is initialized");
  }).catch(function (error) {
    console.warn("error initializing the pap: " + error);
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
  var id = serializeId(entity_id, entity_type);
  console.log("pap: getting fullrecord for Policy id: " + id);
  return pap.getFullRecord(id);
};

Pap.prototype.setDefaultEntityPolicies = function (entity_id, entity_type) {

  var that = this;
  var id = serializeId(entity_id, entity_type);
  return new Promise(function (resolve, reject) {
    /*pap.init(that.conf.upfront).then(function () {
      console.log("creating actor policy for id " + id + " policy for createEntity: " + JSON.stringify(that.conf.policies.create_entity_policy));
      return pap.set(id, that.conf.policies.create_entity_policy);*/
    pap.set(id, that.conf.policies.create_entity_policy).then(function (result) {
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

        //jump through hoops to serialize setting of policies :(
        /*var recurisvePromise = function r(results, errors, promises, i, end){
          console.log("calling next");
          if(i<promises.length){
             promises[i].then(function(res){
                 results.push(res);
                 errors.push(null);
                 r(results, errors, promises, i+1, end);
             }).catch(function(e){
                 console.log("could not resolve promise... error"+e);
                 errors.push(e);
                 results.push(null);
                 r(results, errors, promises, i+1, end);
             });
          }
          else{
            end();
          }
        }*/
        /*var results =  [];
        var errors = [];
        recurisvePromise(results, errors, setting, 0, function(){
            console.log("resolving after executing sequential gets results: "+JSON.stringify(results)+ " errors: "+JSON.stringify(errors));
            return resolve();
        });*/
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

        /*Promise.all(setting).then(function (results) {
          console.log(' resolving after setting stuff ');
          return resolve();
        }, reject);*/

        /*var allSeq = function(array, result){
            if(!result){
              result = [];
            }
            if(array.length>0){
                array[0].then(function(value){
                     console.log("finished with promise. Length of arra yis  "+array.length);
                     console.log("finished with promise. Length of arra yis  "+array.length);
                    result.push(value);
                    return allSeq(array.splice(0,1), result);
                }).catch(function(err){
                    return Promise.reject(err);
                })
            }
            else{
              return Promise.resolve();
            }
        };

        allSeq(setting).then(function (results) {
          console.log(' resolving after setting stuff ');
          return resolve();
        }, reject);*/
      } else {
        resolve();
      }
    }, function err(reason) {

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
    /*pap.init(that.conf.upfront).then(function () {
      if (attribute)
        return pap.get(id, attribute);
      else return pap.get(id, "");
    })*/
    var p;
    if (attribute)
      p = pap.get(id, attribute);
    else
      p = pap.get(id, "");
    p.then(function (policy) {
      if (attribute)
        console.log("found attribute policy for attribute " + attribute + " and  id " + id + " policy " + JSON.stringify(policy));
      else
        console.log("found top policy for id " + id + " policy " + JSON.stringify(policy));
      resolve(policy);
    }, reject);
  });
};

Pap.prototype.getEntityPolicies = function (entity_id, entity_type) {

  var id = serializeId(entity_id, entity_type);
  return new Promise(function (resolve, reject) {
    var p = pap.getFullRecord(id);
    p.then(function (policies) {
      var policiesResult = {};
      for (var attribute in policies.properties) {
        if (policies.properties.hasOwnProperty(attribute) && attribute !== 'entities' && attribute !== 'groups') {
          //Access entities for top_level_policices
          policiesResult[attribute] = policies.properties[attribute];
        }
      }
      console.log("found policy for id " + id + " policy " + JSON.stringify(policiesResult));
      resolve(policiesResult);
    }, reject);
  });
};

Pap.prototype.setEntityPolicy = function (entity_id, entity_type, property, policy) {
  return new Promise(function (resolve, reject) {
    var id = serializeId(entity_id, entity_type);
    pap.set(id, property, policy).then(function (test) {
      console.log("set policy for id " + id + " policy " + JSON.stringify(policy));
      resolve(test);
    }, reject);
  });
};

module.exports = Pap;
