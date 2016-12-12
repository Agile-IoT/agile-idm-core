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

Pap.prototype.store = function(cb){
  //use this.conf to find out where to store the policies
    cb();
}

Pap.prototype.init = function() {
  var conf = this.conf;
  if(!db){
    //load file
    console.log("our conf!:"+JSON.stringify(conf));
    db = {};
    return pap.init(db);
  }
  else {
    console.log('already loaded policy db');
    return Promise.resolve();
  }
}

Pap.prototype.get = function(id) {
  return pap.init().then(function(){
    return pap.get(id);
  });
}

Pap.prototype.getProp = function(id, property) {
  return pap.init().then(function(){
    pap.getProp(id, property);
  });
}

Pap.prototype.setProp = function(id, property, policy) {
  var that = this;
  return new Promise (function(resolve, reject){
      pap.init().then(function(){
        return pap.setProp(id, property, policy);
      }).then(function(result){
        that.store(resolve.bind(pap,result));
      },reject);
  });

}


Pap.prototype.delProp = function(id, property) {
  var that = this;
  return new Promise (function(resolve, reject){
      pap.init().then(function(){
         return pap.delProp(id, property);
       }).then(function(result){
         that.store(resolve.bind(pap,result));
      },reject);
  });

}

Pap.prototype.getEntity = function(id) {
  return pap.init().then(function(){
    return pap.getEntity(id);
  });
}

Pap.prototype.createEntity = function(id, policy) {
  var that = this;
  return new Promise (function(resolve, reject){
      pap.createEntity(id,  policy).then(function(result){
         that.store(resolve.bind(pap,result));
      },reject);
  });
}

Pap.prototype.delEntity = function(id) {
  var that = this;
  return new Promise (function(resolve, reject){
    pap.init().then(function(){
      return pap.delEntity(id);
    }).then(function(result){
        that.store(resolve.bind(pap,result));
      },reject);
  });
}

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
}


module.exports = Pap;
