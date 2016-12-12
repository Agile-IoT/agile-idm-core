var clone = require('clone');
var pap = require('UPFROnt').pap;
var policyDB = null;
var console = require('../log.js');
var db;
var fs = require('fs');

var Pap = function (conf) {
  this.conf = conf;
  console.log("conf: "+JSON.stringify(conf));
  /*if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
      this.conf = conf;
  } else {
      throw createError(500, "Storage module not properly configured!");
  }*/
};

var db = {};

Pap.prototype.setEntityPolicies = function(entity_id, entity_type){

  var that = this;
  return new Promise (function(resolve, reject){
    try{
      db = fs.readFileSync(that.conf.policies.dbName);
      db = JSON.parse(db);
    }catch(e){
      db = {};
    }
    pap.init(db).then(function(){
      console.log("set policies for entity_id "+entity_id+" and entity type "+entity_type);
      return pap.createEntity(entity_id, that.conf.policies.create_entity_policy);
    }).then(function(result){
      var p_entity_type = entity_type.substring(1);
      console.log("looking for entity type "+p_entity_type);
      var setting = [];
      console.log("attribute level");
      console.log(JSON.stringify(that.conf.policies.attribute_level_policies));
      console.log("attribute level");
        if(that.conf.policies.attribute_level_policies.hasOwnProperty(p_entity_type)){
          Object.keys(that.conf.policies.attribute_level_policies[p_entity_type]).forEach(function(k){
              console.log('calling set prop with entity id: '+ entity_id + "attribute value: "+k +" policy: "+ JSON.stringify(that.conf.policies.attribute_level_policies[p_entity_type][k]));
              setting.push(pap.setProp(entity_id,k,that.conf.policies.attribute_level_policies[p_entity_type][k]));
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


module.exports = Pap;
