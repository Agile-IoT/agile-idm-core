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
    if(that.entities)
      throw createError(500, "already initialized");
    var options = {
      valueEncoding: 'json'
    }
    that.entities = level(filename+"_entities", options);
    if(cb)
       cb();
  };

  function buildEntityPk(entity_id, entity_type) {
     return {id: entity_id, type: entity_type};
    return entity_id + "_" + entity_type;
  }

  function pkToString(pk){
    return JSON.stringify(pk);
  }

  function buildGroupPk(owner_id, group_name) {
    return owner_id+ "_" + group_name;
  }
  function buildAttributePk(entity_pk, attrubute_type) {
    return entity_pk + "#" + attrubute_type;
  }
  //creates an object in a given level db connection (action_type)
  function createSomething(that, action_type, entity_id, entity_type, owner, data){
    return new Promise(function (resolve, reject) {
      var pk = buildEntityPk(entity_id, entity_type);
      that[action_type].get(pk, function (err, value) {
         if (err && err.notFound){
           var  entity = clone(data);
           entity.id = entity_id;
           entity.type = entity_type;
           entity.owner = owner;
           that[action_type].put(pk, entity, function (error) {
              if(error)
                 handleError(error, reject);
              else
                that.entities.get(pk, function (err, value) {
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

  function readSomething(that, action_type,entity_id, entity_type){
    return new Promise(function (resolve, reject) {
      var pk = buildEntityPk(entity_id, entity_type);
      that.entities.get(pk, function (error, value) {
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

  function updateSomething(that,action_type,entity_id, entity_type, data){
    return new Promise(function (resolve, reject) {
      var pk = buildEntityPk(entity_id, entity_type);
      that.entities.get(pk, function (err, value) {
         if (!err){
           var  entity = clone(data);
           entity.id = entity_id;
           entity.type = entity_type;
           entity.owner = value.owner;
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

  function deleteSomething(that,action_type,entity_id, entity_type){
    return new Promise(function (resolve, reject) {
      var pk = buildEntityPk(entity_id, entity_type);
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
  //used to handle generic 500 errors
  //TODO improve to split different errors... PK repeated,... etc
  function handleError(error, cb) {
    console.log('sqlite3 error ocurred ' + JSON.stringify(error));
    console.log(error);
    cb(createError(500, error.message));
  }

  //flatten entities for now...
function flattenEntity(data) {
    return data;
}

LevelStorage.prototype.close = function(cb){
  this.db.close(cb);

}
  //inserts a entity with the given id and type in the entity table. The given attributes are stored in the attributeValue table regarding to their type (int or string)
LevelStorage.prototype.createEntityPromise = function (entity_id, entity_type, owner, data) {
  console.log("arguments for createEntity sqlite3 " + JSON.stringify(arguments));
  return createSomething(this, "entities", entity_id, entity_type, owner, data);
};

/*
Reads entity from the database and returns json
*/
LevelStorage.prototype.readEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for readEntity leveldb " + JSON.stringify(arguments));
  return readSomething(this, "entities",entity_id, entity_type );
};

//updates the attributes of the entity with the given id
LevelStorage.prototype.updateEntityPromise = function (entity_id, entity_type, data) {
  console.log("arguments for updateEntity leveldb " + JSON.stringify(arguments));
  return updateSomething(this,"entities",entity_id, entity_type, data);

};

//deletes the entity with the given id and all its attributes
LevelStorage.prototype.deleteEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for deleteEntity leveldb " + JSON.stringify(arguments));
  return deleteSomething(that,"entities",entity_id, entity_type);


};



LevelStorage.prototype.createGroupPromise = function (group_name, owner) {
  console.log("arguments for createGroupPromise sqlite3 " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function (resolve, reject) {

  });
};

LevelStorage.prototype.readGroupPromise = function (group_name, owner) {

};


LevelStorage.prototype.updateGroupPromise = function (group_name, owner) {

};


LevelStorage.prototype.deleteGroupPromise = function (group_name, owner) {
};

LevelStorage.prototype.AddEntityToGroupByIdsPromise = function (group_id,  entity_id, entity_type) {
  console.log("arguments for AddEntityToGroupPromise sqlite3 " + JSON.stringify(arguments));
  var that = this;
  var groupfk, entityfk;
  return new Promise(function (resolve, reject) {
  });

};


LevelStorage.prototype.listEntitiesByAttributeValueAndType = function (attribute_type, attribute_value) {
  var that = this;
  console.log("arguments for listEntitiesByAttributeTypeAndValuetity sqlite3 " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
  });
};

LevelStorage.prototype.listEntitiesByGroupId = function (group_id) {
  var that = this;
  console.log("arguments for listEntitiesByGroupId sqlite3 " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
  });
};

module.exports = LevelStorage;
