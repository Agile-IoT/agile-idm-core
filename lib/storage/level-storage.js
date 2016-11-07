var clone = require('clone');
var createError = require('http-errors');
var console = require('../log.js');
var level = require('level');

var SqliteStorage = function () {

};

//create tables and prepared statements
SqliteStorage.prototype.init = function (storageConf, cb) {
    var filename = storageConf.dbName;
    var that = this;
    if(that.db)
      throw createError(500, "already initialized");
    var options = {
      valueEncoding: 'json'
    }
    that.db = level(filename, options);
    if(cb)
       cb();
  };

  function buildEntityPk(entity_id, entity_type) {
     return {id: entity_id, type: entity_type};
    return entity_id + "_" + entity_type;
  }

  function buildGroupPk(owner_id, group_name) {
    return owner_id+ "_" + group_name;
  }
  function buildAttributePk(entity_pk, attrubute_type) {
    return entity_pk + "#" + attrubute_type;
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

SqliteStorage.prototype.close = function(cb){
  this.db.close(cb);

}
  //inserts a entity with the given id and type in the entity table. The given attributes are stored in the attributeValue table regarding to their type (int or string)
SqliteStorage.prototype.createEntityPromise = function (entity_id, entity_type, owner, data) {
  console.log("arguments for createEntity sqlite3 " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function (resolve, reject) {
    var pk = buildEntityPk(entity_id, entity_type);
    that.db.get(pk, function (err, value) {
       if (err && err.notFound){
         var  entity = clone(data);
         entity.id = entity_id;
         entity.type = entity_type;
         entity.owner = owner;
         that.db.put(pk, entity, function (error) {
            if(error)
               handleError(error, reject);
            else
              that.db.get(pk, function (err, value) {
                 if(error)
                    reject(createError(500, 'cannot read entity with pk '+pk+' after creating it'));
                 else
                    resolve(value);
              });

         });
       }else{
         reject(createError(500, 'entity with pk '+pk+' already exists'));
       }

    });
  });
};

/*
Reads entity from the database and returns json
*/
SqliteStorage.prototype.readEntityPromise = function (entity_id, entity_type) {
  var that = this;
  return new Promise(function (resolve, reject) {
    var pk = buildEntityPk(entity_id, entity_type);
    that.db.get(pk, function (error, value) {
      console.log('get for  entity for pk '+pk+' error '+error +' data '+JSON.stringify(value));
       if(error && error.notFound)
          reject(createError(404, ' read entity with pk '+pk+'  not found'));
       else if(error)
          handleError(error,reject);
       else{
           console.log('found entity for pk '+pk+' resolving with '+JSON.stringify(value));
          resolve(value);
        }
    });

  });
};

//updates the attributes of the entity with the given id
SqliteStorage.prototype.updateEntityPromise = function (entity_id, entity_type, data) {
  console.log("arguments for updateEntity sqlite3 " + JSON.stringify(arguments));
  var that = this;
  var result;
  return new Promise(function (resolve, reject) {
  });
};

//deletes the entity with the given id and all its attributes
SqliteStorage.prototype.deleteEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for deleteEntity sqlite3 " + JSON.stringify(arguments));
  var that = this;
  var result;
  return new Promise(function (resolve, reject) {
  });
};



SqliteStorage.prototype.createGroupPromise = function (group_name, owner) {
  console.log("arguments for createGroupPromise sqlite3 " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function (resolve, reject) {

  });
};

SqliteStorage.prototype.readGroupPromise = function (group_name, owner) {

};


SqliteStorage.prototype.updateGroupPromise = function (group_name, owner) {

};


SqliteStorage.prototype.deleteGroupPromise = function (group_name, owner) {
};

SqliteStorage.prototype.AddEntityToGroupByIdsPromise = function (group_id,  entity_id, entity_type) {
  console.log("arguments for AddEntityToGroupPromise sqlite3 " + JSON.stringify(arguments));
  var that = this;
  var groupfk, entityfk;
  return new Promise(function (resolve, reject) {
  });

};


SqliteStorage.prototype.listEntitiesByAttributeValueAndType = function (attribute_type, attribute_value) {
  var that = this;
  console.log("arguments for listEntitiesByAttributeTypeAndValuetity sqlite3 " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
  });
};

SqliteStorage.prototype.listEntitiesByGroupId = function (group_id) {
  var that = this;
  console.log("arguments for listEntitiesByGroupId sqlite3 " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
  });
};

module.exports = SqliteStorage;
