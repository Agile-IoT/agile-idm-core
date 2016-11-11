var clone = require('clone');
var createError = require('http-errors');
var console = require('../log.js');
var level = require('level');
var transaction = require('level-transactions')

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

  function getPk(action_type, data){
    if(action_type ==="entities")
      return {id: data.id, type: data.type};
    else if(action_type === "groups")
      return {group_name: data.group_name, owner: data.owner};
    else throw createError(500, "programmer mistake... attempting to get pk for unkown entity "+action_type);
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
  function createSomething( action_type, pk , owner, data, transaction, commit){
    if(! transaction )
      throw new createError(500,"call without a transaction to createSomething");
    return new Promise(function (resolve, reject) {
      transaction.get(pk, function (err, value) {
         if (err && err.notFound){
           var entity = buildReturnObject(pk, data, owner);
           transaction.put(pk, entity, function (error) {
              if(error)
                 transaction.rollback(handleError.bind(this,error, reject));
              else
                transaction.get(pk, function (err, value) {
                   if(error)
                      transaction.rollback(reject.bind(this,createError(500, 'cannot read '+action_type+' with pk '+pkToString(pk)+' after creating it')));
                   else{
                      if(commit && commit ===true)
                         transaction.commit(resolve.bind(this,value));
                      else resolve(value);
                   }
                });
           });
         }else{
           transaction.rollback(reject.bind(this,createError(500, action_type+' with pk '+pkToString(pk)+' already exists')));
         }
      });
    });
  }

  //reads an object in a given level db connection (action_type)
  function readSomething( action_type, pk, transaction, commit){
    if(! transaction )
      throw new createError(500,"call without a transaction to readSomething");
    return new Promise(function (resolve, reject) {
      transaction.get(pk, function (error, value) {
        console.log('get for  '+action_type+' for pk '+pkToString(pk)+' error '+error +' data '+JSON.stringify(value));
         if(error && error.notFound)
            transaction.rollback(reject.bind(this,createError(404, ' read '+action_type+' with pk '+pkToString(pk)+'  not found')));
         else if(error)
            transaction.rollback(handleError.bind(this,error,reject));
         else{
             if(value){
               console.log('found '+action_type+' for pk '+pkToString(pk)+' resolving with '+JSON.stringify(value));
               if(commit && commit ===true)
                 transaction.commit(resolve.bind(this,value));
              else
                 resolve(value);
             }
             else {
               transaction.rollback(reject.bind(this,createError(500,"unexpected empty response from get function in the database for pk "+pkToString(pk))));
             }
          }
      });

    });
  }

  //updates an object in a given level db connection (action_type)
  function updateSomething(action_type, pk, data, transaction, commit){
    if(! transaction )
      throw new createError(500,"call without a transaction to updateSomething");
    return new Promise(function (resolve, reject) {
      transaction.get(pk, function (error, value) {
        if(error && error.notFound)
           transaction.rollback(reject.bind(this,createError(404, ' cannot update '+action_type+' with pk '+pkToString(pk)+' it was  not found')));
        else if(error)
           transaction.rollback(handleError.bind(this,error,reject));
         else{
           console.log('entity found with pk '+pkToString(pk))
           var entity = buildReturnObject(pk, data, value.owner);
           transaction.put(pk, entity, function (error) {
              if(error)
                 transaction.rollback(handleError.bind(this,error, reject));
              else
                transaction.get(pk, function (err, value) {
                   if(error)
                      transaction.rollback(reject.bind(this,createError(500, 'cannot read '+action_type+' with pk '+pkToString(pk)+' after creating it')));
                   else if(commit && commit ===true)
                      transaction.commit(resolve.bind(this,value));
                  else
                     resolve(value);
                });
           });
        }
      });
    });
  }

  //deletes an object in a given level db connection (action_type)
  function deleteSomething( action_type, pk, transaction, commit){
    if(! transaction )
      throw new createError(500,"call without a transaction to deleteSomething");
    return new Promise(function (resolve, reject) {
      transaction.get(pk, function (err, value) {
         if (!err){
           transaction.del(pk, function (error) {
              if(error)
                 transaction.rollback(handleError.bind(this,error, reject));
              else if(commit && commit ===true)
                transaction.commit(resolve);
              else
                 resolve();
           });
         }else if(err && err.notFound){
           transaction.rollback(reject.bind(this,createError(404, action_type+' with pk '+pkToString(pk)+' not found')));
         }
         else{
           transaction.rollback(reject.bind(this,createError(500, 'cannot update '+action_type+' with pk '+pkToString(pk)+err)));
         }
      });
    });
  }

  //keyAction and dataAction are functions receive the data item as a parameter and return true or false, depending on whether this item should be added to the result list.
  //results are only added if both functions return true;
  function iterateDbAndSearch( action_type, keyAction, dataAction, transaction, commit){
    if(! transaction )
      throw new createError(500,"call without a transaction to iterateDbAndSearch");
    return new Promise(function (resolve, reject) {
      var results = [];
      transaction.createReadStream()
        .on('data', function (data) {
          if(keyAction(data.key) && dataAction(data.value))
             results.push(buildReturnObject(data.key, data.value, null));
        })
        .on('error', function (err) {
          console.log('soething went wrong while iterating entities in database '+action_type);
          transaction.rollback(reject.bind(this,err));
        })
        .on('end', function () {
          console.log('resolving array after query with '+JSON.stringify(results));
          if(commit && commit ===true)
            transaction.commit(resolve.bind(this,results));
          else
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
  return createSomething("entities", pk, owner, data,transaction(this.entities),true);
};

/*
Reads entity from the database and returns json
*/
LevelStorage.prototype.readEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for readEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return readSomething("entities",pk,transaction(this.entities),true);
};

//updates the attributes of the entity with the given id
LevelStorage.prototype.updateEntityPromise = function (entity_id, entity_type, data) {
  console.log("arguments for updateEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return updateSomething("entities", pk, data, transaction(this.entities),true);
};

//deletes the entity with the given id and all its attributes
LevelStorage.prototype.deleteEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for deleteEntity leveldb " + JSON.stringify(arguments));
  var pk = buildEntityPk(entity_id, entity_type);
  return deleteSomething("entities",pk,transaction(this.entities),true);
};


LevelStorage.prototype.createGroupPromise = function (group_name, owner) {
  console.log("arguments for createGroupPromise leveldb " + JSON.stringify(arguments));
  var group = {};
  group.entities = [];
  var pk = buildGroupPk(group_name, owner);
  return createSomething("groups", pk, owner, group,transaction(this.groups),true);
};

LevelStorage.prototype.readGroupPromise = function (group_name, owner) {
  console.log("arguments for readGroupPromise leveldb " + JSON.stringify(arguments));
  var pk = buildGroupPk(group_name, owner);
  return readSomething("groups", pk,transaction(this.groups),true);
};


LevelStorage.prototype.updateGroupPromise = function (group_name, owner, data) {
  console.log("arguments for updateGroupPromise leveldb " + JSON.stringify(arguments));
  var pk = buildGroupPk(group_name, owner);
  return updateSomething("groups", pk, data, transaction(this.groups),true);
};


LevelStorage.prototype.deleteGroupPromise = function (group_name, owner) {
  console.log("arguments for deleteGroupPromise leveldb " + JSON.stringify(arguments));
  var pk = buildGroupPk(group_name, owner);
  return deleteSomething("groups",pk, transaction(this.groups),true);

};

LevelStorage.prototype.addEntityToGroupPromise = function (group_name, owner,  entity_id, entity_type) {
  function rollback(t1,t2,callback){
    t1.rollback(t2.rollback(callback));
  }
  console.log("arguments for AddEntityToGroupPromise leveldb " + JSON.stringify(arguments));
  var that = this;
  var group, entity;
  return new Promise(function(resolve,reject){
    var group_pk =  buildGroupPk(group_name, owner);
    var entity_pk = buildEntityPk(entity_id, entity_type);
    var t_groups = transaction(that.groups);
    var t_entities = transaction(that.entities);

    readSomething("groups", group_pk ,t_groups,false)
      .then(function(g){
        group = g;
        console.log(JSON.stringify(group)+'entities' +group.entities);
        var already_in_group = group.entities.filter(function (v) {
             console.log("processing entity "+JSON.stringify(v)+" in group "+JSON.stringify(group));
             return (v.id  == entity_id && v.type == entity_type);
        });
        if(already_in_group.length > 0)
           return rollback(t_entities,t_groups,reject.bind(this,createError(409, "entity with id "+entity_id+ " and type"+ entity_type+" is already in group with group name "+group_name+ " owned by "+owner)));
        else
           return readSomething("entities", entity_pk ,t_entities,false);
      }).then(function(e){
        entity = e;
        console.log('got entity '+entity+entity_id+ entity_type);
        if(!entity.hasOwnProperty("groups"))
          entity.groups = [];
        console.log('groups' +entity.groups);
        var already_in_group = entity.groups.filter(function (v) {
             return (v.group_name === group.group_name && v.owner === group.owner);
        });
        if(already_in_group.length > 0){
          return rollback(t_entities,t_groups,reject.bind(this,createError(409, "entity with id "+pkToString(getPk("entities",entity))+" is already in group with group name "+group_name+ " owned by "+owner+" seems there is an inconsistency")));
        }
        else{
          entity.groups.push(getPk("groups",group));
          group.entities.push(getPk("entities",entity));
          return updateSomething("entities", entity_pk, entity, t_entities);
        }
      }).then(function(result){
          console.log('entity updated with group '+JSON.stringify(result));
          return updateSomething("groups", group_pk, group, t_groups);
      }).then(function(result){
          console.log(' group updated with group '+JSON.stringify(result));
          return readSomething("entities", entity_pk ,t_entities,false);
      }).then(function(r){
          console.log('resolving with updated entity '+JSON.stringify(r));
          t_entities.commit(function(){
             t_groups.commit(function(){
                resolve(r);
            });
          });
          //resolve(r);
      }, function rej(reason){
          console.log('rejecting '+reason);
          return rollback(t_entities,t_groups,reject.bind(this,reason));
      });

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
  return iterateDbAndSearch("entities",keyAction, dataAction, transaction(this.entities), true);
};

LevelStorage.prototype.listEntitiesByGroup = function (group_name, owner) {
  console.log("arguments for listEntitiesByGroupId leveldb " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function(resolve,reject){
    that.readGroupPromise(group_name,owner)
      .then( function(group){
        resolve(group.entities);
      },reject);
  });
};

module.exports = LevelStorage;
