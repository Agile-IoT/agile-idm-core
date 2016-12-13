var clone = require('clone');
var pap = require('UPFROnt').pap;
var policyDB = null;
var console = require('../log.js');
var db;
var fs = require('fs');


function serializeId(entity_id, entity_type){
  //return entity_id+"!-!"+entity_type;
  return entity_id;
}

var Pap = function (conf) {
  this.conf = conf;
  console.log("intializing pap: ");
  /*if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
      this.conf = conf;
  } else {
      throw createError(500, "Storage module not properly configured!");
  }*/
};

var db = {};

Pap.prototype.setEntityPolicies = function(entity_id, entity_type){

  var that = this;
  var id = serializeId(entity_id, entity_type);
  return new Promise (function(resolve, reject){
    try{
      db = fs.readFileSync(that.conf.policies.dbName);
      db = JSON.parse(db);
    }catch(e){
      db = {};
    }
    pap.init(db).then(function(){
      console.log("creating actor policy for id "+id+" policy for createEntity: "+JSON.stringify(that.conf.policies.create_entity_policy));
      return pap.createEntity(id, that.conf.policies.create_entity_policy);
    }).then(function(result){
      console.log("setting top level policy for id "+id + " policy "+JSON.stringify(that.conf.policies.top_level_policy));
      return pap.setProp(id, that.conf.policies.top_level_policy);
    }).then(function(result){
      var p_entity_type = entity_type.substring(1);
      console.log("looking for entity type "+p_entity_type);
      var setting = [];
        if(that.conf.policies.attribute_level_policies.hasOwnProperty(p_entity_type)){
          Object.keys(that.conf.policies.attribute_level_policies[p_entity_type]).forEach(function(k){
              console.log('calling set prop with id '+ id  + " attribute value: "+k +" policy: "+ JSON.stringify(that.conf.policies.attribute_level_policies[p_entity_type][k]));
              setting.push(pap.setProp(id,k,that.conf.policies.attribute_level_policies[p_entity_type][k]));
          });
          Promise.all(setting).then(function(results){
             console.log(' resolving after setting stuff ');
             fs.writeFile(that.conf.policies.dbName,JSON.stringify(db),function(){
             return resolve();
          });
          }, reject);
        }
        else{
          resolve();
        }
      },reject);
  });
};


// attribute can be undefined, then it fetches the policy for the root of the object
Pap.prototype.getAttributePolicy = function(entity_id, entity_type, attribute){

  var that = this;
  var id = serializeId(entity_id, entity_type);
  return new Promise (function(resolve, reject){
    try{
      db = fs.readFileSync(that.conf.policies.dbName);
      db = JSON.parse(db);
    }catch(e){
      db = {};
    }
    pap.init(db).then(function(){
      if(attribute)
        return  pap.getProp(id, attribute);
      else return  pap.getProp(id);
    }).then(function(policy){
      if(attribute)
        console.log("found attribute policy for attribute "+attribute +" and  id "+id+" policy "+JSON.stringify(policy));
      else
        console.log("found top policy for id "+id+" policy "+JSON.stringify(policy));
      resolve(policy);
    },reject);
  });
};


module.exports = Pap;
