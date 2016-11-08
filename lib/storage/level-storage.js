var clone = require('clone');
var createError = require('http-errors');
var console = require('../log.js');
var level = require('level');

var LevelStorage = function () {

};

//create tables and prepared statements
LevelStorage.prototype.init = function (storageConf, cb) {
    var filename = storageConf.dbName;
    var that = this;
    if(that.entities || that.groups)
      throw createError(500, "already initialized");
    var options = {
      keyEncoding: 'json',
      valueEncoding: 'json'
    };
    that.entities = level(filename+"_entities", options);
    that.groups  = level(filename+"_groups", options);
    if(cb)
       cb();
  };

  //helpers to build and print pks...
  function buildEntityPk( entity_id, entity_type) {
      return {id: entity_id, type: entity_type};
  }

  function buildGroupPk( group_name, owner ){
      return {group_name: group_name, owner: owner};
  }


  function pkToString(pk){
    return JSON.stringify(pk);
  }

  //helpers to resolve return object with pk+entity data
  //this function contemplates that owner can be null, e.g. when called for a group; however the owner is already part of entity.
  //Therefore so the result always contains an owner.
  function buildReturnObject(pk, data, owner){
    var  entity = clone(data);
    Object.keys(pk).forEach(function(key) {
      entity[key] = pk[key];
    });
    if(owner)
      entity.owner = owner;
    return entity;
  }

  //creates an object in a given level db connection (action_type)
  function createSomething(that, action_type, pk , owner, data){
    return new Promise(function (resolve, reject) {
      that[action_type].get(pk, function (err, value) {
         if (err && err.notFound){
           var entity = buildReturnObject(pk, data, owner);
           that[action_type].put(pk, entity, function (error) {
              if(error)
                 handleError(error, reject);
              else
                that[action_type].get(pk, function (err, value) {
                   if(error)
                      reject(createError(500, 'cannot read '+action_type+' with pk '+pkToString(pk)+' after creating it'));
                   else
                      resolve(value);
                });

           });
         }else{
           reject(createError(500, action_type+' with pk '+pkToString(pk)+' already exists'));
         }

      });
    });
  }

  //reads an object in a given level db connection (action_type)
  function readSomething(that, action_type, pk){
    return new Promise(function (resolve, reject) {
      that[action_type].get(pk, function (error, value) {
        console.log('get for  '+action_type+' for pk '+pkToString(pk)+' error '+error +' data '+JSON.stringify(value));
         if(error && error.notFound)
            reject(createError(404, ' read '+action_type+' with pk '+pkToString(pk)+'  not found'));
         else if(error)
            handleError(error,reject);
         else{
             console.log('found '+action_type+' for pk '+pkToString(pk)+' resolving with '+JSON.stringify(value));
            resolve(value);
          }
      });

    });
  }

  //updates an object in a given level db connection (action_type)
  function updateSomething(that,action_type, pk, data){
    return new Promise(function (resolve, reject) {
      that[action_type].get(pk, function (err, value) {
         if (!err){
           var entity = buildReturnObject(pk, data, value.owner);
           that[action_type].put(pk, entity, function (error) {
              if(error)
                 handleError(error, reject);
              else
                that[action_type].get(pk, function (err, value) {
                   if(error)
                      reject(createError(500, 'cannot read '+action_type+' with pk '+pkToString(pk)+' after creating it'));
                   else
                      resolve(value);
                });

           });
         }else if(err && err.notFound){
           reject(createError(404, action_type+' with pk '+pkToString(pk)+' not found'));
         }
         else{
           reject(createError(500, 'cannot update '+action_type+' with pk '+pkToString(pk)+err));
         }

      });
    });
  }

  //deletes an object in a given level db connection (action_type)
  function deleteSomething(that, action_type, pk){
    return new Promise(function (resolve, reject) {
      that[action_type].get(pk, function (err, value) {
         if (!err){
           that[action_type].del(pk, function (error) {
              if(error)
                 handleError(error, reject);
              else
                 resolve();
           });
         }else if(err && err.notFound){
           reject(createError(404, action_type+' with pk '+pkToString(pk)+' not found'));
         }
         else{
           reject(createError(500, 'cannot update '+action_type+' with pk '+pkToString(pk)+err));
         }

      });
    });
  }

  //keyAction and dataAction are functions receive the data item as a parameter and return true or false, depending on whether this item should be added to the result list.
  //results are only added if both functions return true;
  function iterateDbAndSearch(that, action_type, keyAction, dataAction){
    return new Promise(function (resolve, reject) {
      var results = [];
      that[action_type].createReadStream()
        .on('data', function (data) {
          console.log("processing: "+JSON.stringify(data))
          console.log("key action : "+keyAction(data.key))
          console.log("data  action : "+dataAction(data.value))
          if(keyAction(data.key) && dataAction(data.value))
             results.push(buildReturnObject(data.key, data.value, null));
        })
        .on('error', function (err) {
          console.log('soething went wrong while iterating entities in database '+action_type);
          reject(err)
        })
        .on('end', function () {
          console.log('resolving array after query with '+JSON.stringify(results));
          resolve(results);
        });
    });


  }
  //used to handle generic 500 errors
  //TODO improve to split different errors... PK repeated,... etc
  function handleError(error, cb) {
    console.log('leveldb error ocurred ' + JSON.stringify(error));
    console.log(error);
    cb(createError(500, error.message));
  }



LevelStorage.prototype.close = function(cb){
  this.entities.close();
  this.groups.close();
};
  //inserts a entity with the given id and type in the entity table. The given attributes are stored in the attributeValue table regarding to their type (int or string)
LevelStorage.prototype.createEntityPromise = function (entity_id, entity_type, owner, data) {
  console.log("arguments for createEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return createSomething(this, "entities", pk, owner, data);
};

/*
Reads entity from the database and returns json
*/
LevelStorage.prototype.readEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for readEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return readSomething(this, "entities",pk);
};

//updates the attributes of the entity with the given id
LevelStorage.prototype.updateEntityPromise = function (entity_id, entity_type, data) {
  console.log("arguments for updateEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return updateSomething(this,"entities",pk, data);

};

//deletes the entity with the given id and all its attributes
LevelStorage.prototype.deleteEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for deleteEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return deleteSomething(that,"entities",pk);
};


/*function clean(that,action_type){
  return new Promise(function(resolve, reject){
    that[action_type].createKeyStream()
    .on('data', function (data) {
      console.log('deleting data...');
      that[action_type].del(data);
    })
    .on('end', function () {
      console.log("finished cleaning"+action_type);
      resolve();
    });
  });
}
promise.all([clean(this, 'entities'), clean(this, 'groups')]).then(function(data){
  cb();
})*/

LevelStorage.prototype.createGroupPromise = function (group_name, owner) {
  console.log("arguments for createGroupPromise leveldb " + JSON.stringify(arguments));
  var group = {};
  group.entites = [];
  var pk = buildGroupPk(group_name, owner);
  return createSomething(this, "groups", pk, owner, group);
};

LevelStorage.prototype.readGroupPromise = function (group_name, owner) {
  console.log("arguments for readGroupPromise leveldb " + JSON.stringify(arguments));
  var pk = buildGroupPk(group_name, owner);
  return readSomething(this, "groups", pk);
};


LevelStorage.prototype.updateGroupPromise = function (group_name, owner) {
  throw new Error("unimplemented");
  //maybe we don't need this? since we have add and remove entities rom group?
  console.log("uninmplemented");
};


LevelStorage.prototype.deleteGroupPromise = function (group_name, owner) {
  console.log("arguments for deleteGroupPromise leveldb " + JSON.stringify(arguments));
  var pk = buildGroupPk(group_name, owner);
  return deleteSomething(that,"groups",pk);

};

LevelStorage.prototype.AddEntityToGroupByIdsPromise = function (group_id,  entity_id, entity_type) {
  console.log("arguments for AddEntityToGroupPromise leveldb " + JSON.stringify(arguments));
  var that = this;
  var groupfk, entityfk;
  return new Promise(function (resolve, reject) {
  });

};


LevelStorage.prototype.listEntitiesByAttributeValueAndType = function (attribute_type, attribute_value) {
  console.log("arguments for listEntitiesByAttributeTypeAndValuetity leveldb " + JSON.stringify(arguments));
  function keyAction(key){
    return true;
  }
  function dataAction(value){
    if(value.hasOwnProperty(attribute_type) && value[attribute_type] === attribute_value)
      return true;
    else
      return false;
  }
  return iterateDbAndSearch(this, "entities",keyAction, dataAction);
};

LevelStorage.prototype.listEntitiesByGroupId = function (group_id) {
  console.log("arguments for listEntitiesByGroupId leveldb " + JSON.stringify(arguments));
  function keyAction(key){
    return true;
  }
  function dataAction(value){
    if(value.hasOwnProperty(attribute_type) && value[attribute_type] === attribute_value)
      return true;
    else
      return false;
  }
  return iterateDbAndSearch(this, "entities",keyAction, dataAction);
};

module.exports = LevelStorage;
