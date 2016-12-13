var Pap = require('./pap');
var createError = require('http-errors');
var console = require('../log');
var pdp = require('UPFROnt').pdp;
var clone = require('clone');



var Pdp = function (conf) {
  console.log("intializing pdp: ");
  this.conf = conf;
  this.pap = new Pap(conf);
  /*if (conf.hasOwnProperty("storage") && conf["storage"].hasOwnProperty("dbName")) {
      this.conf = conf;
  } else {
      throw createError(500, "Storage module not properly configured!");
  }*/
};

//TODO this function needs to resolve regardless of whether the call is performed with an entity or a group as the second argment.
Pdp.prototype.canRead = function (userInfo, entityInfo) {
  return new Promise(function (resolve, reject) {
    // TODO add id and type to object!
    if (1 == 1)
      resolve(entityInfo);
    else
      reject(createError(403, "user unauthorized for the action for entity :" + JSON.stringify(entityInfo)));

  });
};

/*function buildPromiseReadAcc(that,userInfo,entity){
  return new Promise(function (res, rej) {
    that.canRead(userInfo, entity).then(function () {
      console.log('user can read entity ' + JSON.stringify(entity));
      res(entity);
    }, res); //NOTE if not possible to read we still resolve but don't add it to the resultset
  });
}*/


//resolves with an array of entities that can be read (each entry in the array is an entity)
Pdp.prototype.canReadArray = function (userInfo, entitiesArray) {
  var promises = [];
  var that = this;
  return new Promise(function (resolve, reject) {
    for (var i in entitiesArray)
      promises.push(that.canRead(userInfo,entitiesArray[i]));
    Promise.all(promises).then(function (entitiesResult) {
      resolve(entitiesResult);
    }, function (cause) {
      reject(cause);
    });
  });
};


Pdp.prototype.canDelete = function (userInfo, entityInfo) {
  return new Promise(function (resolve, reject) {
    // TODO add id and type to object!
    if (true)
      resolve();
    else
      reject(createError(403, "user unauthorized for the action for entity :" + JSON.stringify(entityInfo)));

  });
};

//for now this is required to check when a user can put an entity in a group. In this case we check whether the user can change the group
Pdp.prototype.canUpdate = function (userInfo, entityInfo) {
  return new Promise(function (resolve, reject) {
    // TODO add id and type to object!
    if (true)
      resolve(entityInfo);
    else
      reject(createError(403, "user unauthorized for the action for entity :" + JSON.stringify(entityInfo)));

  });
};


Pdp.prototype.canWriteToAttribute = function (userInfo, entityInfo, attributeName, attributeValue) {
  var that = this;
  console.log("arguments for canWriteToAttribute "+JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {

    console.log("checking whether user with id "+userInfo.id+ " can write to attribute name "+attributeName+ " the value "+attributeValue+ "of entity with id "+entityInfo.id+ " and entity type: "+entityInfo.type);
    var ps = [that.pap.getAttributePolicy(entityInfo.id, entityInfo.type),
    that.pap.getAttributePolicy(entityInfo.id, entityInfo.type, attributeName)];
    Promise.all(ps)
      .then(function(policies){

          var userInfoPolicy = policies[0];
          console.log("calling pdp to check wether "+userInfo.id+" can write to "+entityInfo.id+" in attribute "+attributeName);
          console.log("arguments: ");
          console.log("             "+JSON.stringify(userInfo));
          console.log("             "+JSON.stringify(policies[0]));
          console.log("             "+JSON.stringify(entityInfo));
          console.log("             "+JSON.stringify(policies[1]));
          return pdp.checkWrite({
            "type":"user",
            "data":userInfo
          }, policies[0],  {
            "type": entityInfo.type.substring(1),
            "data":entityInfo
          } ,policies[1]);
      }).then(function(decision) {
           console.log("pdp decision "+JSON.stringify(decision));
          if(decision.result === true)
            resolve();
          else {
            var err = createError(403, "policy does not allow  the user (or entity authenticated) to set attribute");
            err.conflicts = decision.conflicts;
            reject(err);
          }
      },reject);


  });
};


Pdp.prototype.canWriteToAllAttributes = function (userInfo, entityInfo, entity_id, entity_type, entity_owner) {
  var that = this;
  console.log("arguments for canWriteToAllAttributes "+JSON.stringify(arguments));
  //promise that always resolves to collect all errors.
  function buildPromise(userInfo, entityInfo, entity_type,
  entity_id, attributeName, attributeValue, entity_owner){

    return new Promise(function (resolve, reject) {
      entityInfo = clone(entityInfo);
      entityInfo.id = entity_id;
      entityInfo.type = entity_type.substring(1);
      entityInfo.owner = entity_owner;
      userInfo = clone(userInfo);
      userInfo.type = userInfo.type.substring(1);

      that.canWriteToAttribute(userInfo, entityInfo,
      attributeName,
      attributeValue
      ).then(function(result){
            resolve({result:true});
      },function(er){
            resolve({result:false,conflicts:er.conflicts});
      });
    });
  }
  //now we start with the code
  return new Promise(function (resolve, reject) {
    var promises = [];
    var keys = Object.keys(entityInfo);
    for (var i in keys){
      promises.push(buildPromise(userInfo,
      entityInfo,
      entity_type,
      entity_id,
      keys[i],
      entityInfo[keys[i]],
      entity_owner));
    }


    Promise.all(promises).then(function (pdpResult) {
      var errors = "policy does not allow the user (or entity authenticated) with id "+userInfo.id+" to set the entity with id "+entity_id+" and type "+entity_type+". Spefifically the following attributes are not allowed: ";
      var count = 0;
      var conflicts = [];
      for(var i in pdpResult){
        if(pdpResult[i].result !== true){
          count = count+1;
          errors = errors + " " + keys[i];
          conflicts.push({"attribute":keys[i], "conf":pdpResult[i].conflicts});
        }
      }
      if(count>0){
         console.log( "policy does not allow the user (or entity authenticated) with id "+userInfo.id+" to set the entity with id "+entity_id+" and type "+entity_type);
         console.log("Conflicts for policy "+JSON.stringify(conflicts));
         var err = createError(403, errors);
         err.conflicts = conflicts;
         return reject(err);
      }
      else
         return resolve();
    }, function (cause) {
      reject(cause);
    });
  });
};

module.exports = Pdp;
