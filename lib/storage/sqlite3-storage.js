var clone = require('clone');
var createError = require('http-errors');
var console = require('../log.js');
var sqlite3 = require('sqlite3').verbose();

var SqliteStorage = function () {

};

//create tables and prepared statements
SqliteStorage.prototype.init = function (storageConf, cb) {
    var filename = storageConf.dbName;
    var that = this;
    that.storage = new sqlite3.Database(filename, function (error) {
      if (error) {
        //we can't recover from this...
        throw error;
      } else {
        that.storage.serialize(function () {
          that.storage.run("CREATE TABLE IF NOT EXISTS Entity (pk TEXT PRIMARY KEY, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL, owner TEXT NOT NULL)");
          that.storage.run("CREATE TABLE IF NOT EXISTS StringAttributeValue (id TEXT PRIMARY KEY, fk_entity_pk TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL)");
          that.storage.run("CREATE TABLE IF NOT EXISTS IntAttributeValue (id TEXT PRIMARY KEY, fk_entity_pk TEXT NOT NULL, type TEXT NOT NULL, value INT NOT NULL)");
          that.storage.run("CREATE TABLE IF NOT EXISTS UserGroup (id TEXT PRIMARY KEY, group_name TEXT NOT NULL, owner TEXT NOT NULL)");
          that.storage.run("CREATE TABLE IF NOT EXISTS EntityUserGroup (fkEntity TEXT NOT NULL, fkUserGroup TEXT NOT NULL,  PRIMARY KEY (fkEntity, fkUserGroup))");

          that.get_entity_attributes_by_id_statement = that.storage.prepare("SELECT type, value from StringAttributeValue WHERE fk_entity_pk =$pk UNION SELECT type, value from IntAttributeValue WHERE fk_entity_pk =$pk");
          that.get_entity_by_id_and_type_statement = that.storage.prepare("SELECT * from Entity WHERE entity_id =? and entity_type =?");
          that.get_entity_by_pk_statement = that.storage.prepare("SELECT * from Entity WHERE pk =?");
          that.get_entity__id_by_string_attribute_value_statement = that.storage.prepare("SELECT fk_entity_pk from StringAttributeValue where  type = ? and value = ?");
          that.get_group_by_id_statement = that.storage.prepare("SELECT * from UserGroup WHERE id =?");
          that.get_memberships_by_entitypk = that.storage.prepare("SELECT * FROM EntityUserGroup   WHERE fkEntity =?");
          that.get_memberships_by_grouppk = that.storage.prepare("SELECT * FROM EntityUserGroup   WHERE  fkUserGroup =?");

          that.store_entity_statement = that.storage.prepare("INSERT INTO Entity  (pk , entity_id, entity_type, owner) VALUES(?, ?, ?, ?)");
          that.store_group_statement = that.storage.prepare("INSERT INTO UserGroup  (id, group_name,  owner) VALUES(?, ?, ?)");
          that.store_string_attribute_value_statement = that.storage.prepare("INSERT INTO StringAttributeValue  (id, fk_entity_pk, type, value) VALUES(?, ?, ?, ?)");
          that.store_int_attribute_value_statement = that.storage.prepare("INSERT INTO IntAttributeValue  (id, fk_entity_pk, type, value) VALUES(?, ?, ?, ?)");
          that.store_entity_in_group_statement = that.storage.prepare("INSERT INTO EntityUserGroup  (fkEntity, fkUserGroup ) VALUES( ?, ?)");

          that.delete_entity_by_id_statement = that.storage.prepare("DELETE FROM Entity WHERE pk = ?");
          that.delete_all_int_attributes_by_entity_id_statement = that.storage.prepare("DELETE from IntAttributeValue WHERE fk_entity_pk =?");
          that.delete_all_string_attributes_by_entity_id_statement = that.storage.prepare("DELETE from StringAttributeValue WHERE fk_entity_pk =?");


        });

        cb();
      }
    });
  };

  function buildEntityPk(entity_id, entity_type) {
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
    cb(createError(500, error.message));
  }

  //flatten entities for now...
function flattenEntity(data) {
  if (data) {
    //TODO horrible hack to keep sqlite schema simple... figure out somee day what to do...
    var d1 = clone(data);
    data = d1;
    var keys = Object.keys(data);
    for (var i in keys) {
      if (typeof (data[keys[i]]) !== "number" && typeof (data[keys[i]]) !== "string") {
        data[keys[i]] = JSON.stringify(data[keys[i]]);
      }
    }
    return data;
  }
}


//converts the given sql-result rows to an object
function sqlRowsToEntity(entity, attributes) {
  var result = {};
  attributes.forEach(function (item) {
    result[item.type] = item.value;
  });
  result.id = entity.entity_id;
  result.type = entity.entity_type;
  result.owner = entity.owner;
  return result;
}

//converts the given sql-result rows to an object
function sqlRowsToGroup( grouprow) {
  var result = clone(grouprow);
  return result;
}

/*
  resolves the entity as it is stored in the database including the id, owner and type.
*/
function storeAttributesPromise(entity_id, entity_type, owner, data, that) {
  return new Promise(function (resolve, reject) {
    var entity_pk = buildEntityPk(entity_id, entity_type);
    that.storage.serialize(function () {
      that.storage.run("BEGIN", function (error) {
        console.log('begin  creation of entity attributes transaction  for entity with id ' + entity_id + " and type " + entity_type);
        if (error) {
          reject(createError(500, "cannot start a transaction" + error));
        } else {
          for (var type in data) {
            if (typeof (data[type]) === "string"){
              that.store_string_attribute_value_statement.run(buildAttributePk(entity_pk, type), entity_pk, type, data[type]);
            }else if (typeof (data[type]) === "number"){
              that.store_int_attribute_value_statement.run(buildAttributePk(entity_pk, type), entity_pk, type, data[type]);
            }else{
              reject(createError(500, "attribute type not string or number: " + typeof (data[type])));
            }
          }
          that.storage.run("COMMIT", function (error) {
            if (error) {
              reject(createError(500, "cannot commit transaction  :" + error));
            } else {
              console.log('end of creation of attributes for entity with id ' + entity_id + " and type " + entity_type + " and owner " + owner);
              var result = clone(data);
              result.id = entity_id;
              result.type = entity_type;
              result.owner = owner;
              console.log("return " + JSON.stringify(result));
              resolve(result);
            }
          });
        }
      });
    });

  });
}

//promise to get an entity by ID
function buildPromiseEntityByPk(that,fk_entity_pk){
  var args = clone(arguments);
  delete args["0"];
  console.log("arguments for readEntityPromise by Pk sqlite3 " + JSON.stringify(args));
  return new Promise(function (resolve, reject) {
    console.log("executing promise for readEntityPromise sqlite3 ");
    that.get_entity_by_pk_statement.get(fk_entity_pk, function (error, row) {
      if (error) {
        handleError(error, reject);
      } else if (!row) {
        reject(createError(404, "entity pk " + fk_entity_pk + "not found "));
      } else {
        that.get_entity_attributes_by_id_statement.all(row.pk, function (error, rows) {
          if (error) {
            handleError(error, reject);
          } else if (!rows || rows.length === 0) {
            reject(createError(404, "attributes for entity with  pk " + fk_entity_pk +" not found"));
          } else {

            var data = sqlRowsToEntity(row, rows);
            that.get_memberships_by_entitypk.all(fk_entity_pk, function (error, memberships) {
              if (error) {
                handleError(error, reject);
              }
              else{
                for(var i in memberships){
                    console.log("membership!!! "+JSON.stringify(memberships[i]));
                    if(!data.hasOwnProperty("group_ids"))
                      data.group_ids = [];
                    data.group_ids.push(memberships[i].fkUserGroup);
                }
                console.log("resolving promise for readEntityPromise sqlite3 with "+JSON.stringify(data));
                resolve(data);
              }
            });
          }
        });
      }
    });
  });
}

function buildPromiseGetGroupById(that, pk){
  return new Promise(function (resolve, reject) {
    console.log('executing sqlite3 read group promise for pk '+pk);
    that.get_group_by_id_statement.get(pk, function (error, row) {
      if (error) {
        handleError(error, reject);
      } else if (!row || row.length === 0) {
        console.log('rejecting: group not found '+(createError(404, "group with id " + pk + " not found")));
        reject(createError(404, "group with id " + pk + " not found"));
      } else {
        var res = sqlRowsToGroup( row);
        console.log('resolving group query in sqlite3 with  .'+JSON.stringify(res));
        resolve(res);
      }
    });
  });
}


  //inserts a entity with the given id and type in the entity table. The given attributes are stored in the attributeValue table regarding to their type (int or string)
SqliteStorage.prototype.createEntityPromise = function (entity_id, entity_type, owner, data) {
  console.log("arguments for createEntity sqlite3 " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function (resolve, reject) {
    console.log('executing sqlite3 storage entity promise');
    data = flattenEntity(data);
    var entity_pk = buildEntityPk(entity_id, entity_type);
    that.store_entity_statement.run(entity_pk, entity_id, entity_type, owner, function (error) {
      if (error) {
        handleError(error, reject);
      } else {
        storeAttributesPromise(entity_id, entity_type, owner, data, that).then(resolve, reject);
      }
    });

  });
};

/*
Reads entity from the database and returns json
*/
SqliteStorage.prototype.readEntityPromise = function (entity_id, entity_type) {
  var fk_entity_pk = buildEntityPk(entity_id, entity_type);
  return buildPromiseEntityByPk(this,fk_entity_pk);
};

//updates the attributes of the entity with the given id
SqliteStorage.prototype.updateEntityPromise = function (entity_id, entity_type, data) {
  console.log("arguments for updateEntity sqlite3 " + JSON.stringify(arguments));
  var that = this;
  var result;
  return new Promise(function (resolve, reject) {
    that.readEntityPromise(entity_id, entity_type)
      .then(function (res) {
        result = res;
        console.log("entity for update found " + JSON.stringify(result));
        data = flattenEntity(data);
        var entity_pk = buildEntityPk(entity_id, entity_type);
        that.delete_all_int_attributes_by_entity_id_statement.run(entity_pk, function (error) {
          if (error) {
            handleError(error, reject);
          } else {
            that.delete_all_string_attributes_by_entity_id_statement.run(entity_pk, function (error) {
              console.log("update for entity with id " + entity_id + " and type " + entity_type + ". Old attributes are deleted");
              if (error) {
                handleError(error, reject);
              } else {
                console.log("update for entity with id " + entity_id + " and type " + entity_type + ". creating new values of attributes");
                storeAttributesPromise(entity_id, entity_type, result.owner, data, that).then(resolve, reject);
              }
            });
          }
        });
      }, reject);
  });
};

//deletes the entity with the given id and all its attributes
SqliteStorage.prototype.deleteEntityPromise = function (entity_id, entity_type) {
  console.log("arguments for deleteEntity sqlite3 " + JSON.stringify(arguments));
  var that = this;
  var result;
  return new Promise(function (resolve, reject) {
    that.readEntityPromise(entity_id, entity_type)
      .then(function (res) {
        result = res;
        console.log("entity for delete found " + JSON.stringify(result));
        var entity_pk = buildEntityPk(entity_id, entity_type);
        that.delete_all_int_attributes_by_entity_id_statement.run(entity_pk, function (error) {
          if (error) {
            handleError(error, reject);
          } else {
            that.delete_all_string_attributes_by_entity_id_statement.run(entity_pk, function (error) {
              console.log("Delete for entity with id " + entity_id + " and type " + entity_type + ". Old attributes are deleted");
              if (error) {
                handleError(error, reject);
              } else {
                console.log("Delete for entity with id " + entity_id + " and type " + entity_type);
                that.delete_entity_by_id_statement.run(entity_pk, function (error) {
                  if (error) {
                    handleError(error, reject);
                  } else {
                    resolve();
                  }
                });
                }
            });
          }
        });
    }, reject);
  });
};



SqliteStorage.prototype.createGroupPromise = function (group_name, owner) {
  console.log("arguments for createGroupPromise sqlite3 " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function (resolve, reject) {
    console.log('executing sqlite3 storage group creation promise');
    var pk = buildGroupPk(owner,group_name);
    that.store_group_statement.run(pk, group_name,  owner, function (error) {
      if (error) {
        handleError(error, reject);
      } else {
        var result = {id:pk, owner:owner, group_name: group_name};
        resolve(result);
      }
    });

  });
};

SqliteStorage.prototype.readGroupPromise = function (group_name, owner) {
   console.log("arguments for readGroupPromise sqlite3 " + JSON.stringify(arguments));
    var that = this;
    var pk = buildGroupPk(owner,group_name);
    return buildPromiseGetGroupById(that, pk);
};


SqliteStorage.prototype.updateGroupPromise = function (group_name, owner) {

   throw new Error('unimplemented!');
   console.log("arguments for readGroupPromise sqlite3 " + JSON.stringify(arguments));
    var that = this;
    var pk = buildGroupPk(owner,group_name);
    return buildPromiseGetGroupById(that, pk);
};


SqliteStorage.prototype.deleteGroupPromise = function (group_name, owner) {
  throw new Error('unimplemented!');
  console.log("arguments for deleteGroupPromise sqlite3 " + JSON.stringify(arguments));
  var that = this;
  return new Promise(function (resolve, reject) {
    console.log('executing sqlite3 storage deleteGroupPromise promise');
    that.readGroupPromise.then(function(read){

    }, reject);
    var pk = buildGroupPk(owner,group_name);
    that.store_group_statement.run(pk, group_name,  owner, function (error) {
      if (error) {
        handleError(error, reject);
      } else {
        var result = {id:pk, owner:owner, group_name: group_name};
        resolve(result);
      }
    });
  });
};

SqliteStorage.prototype.AddEntityToGroupByIdsPromise = function (group_id,  entity_id, entity_type) {
  console.log("arguments for AddEntityToGroupPromise sqlite3 " + JSON.stringify(arguments));
  var that = this;
  var groupfk, entityfk;
  return new Promise(function (resolve, reject) {
    console.log("start executing promise for AddEntityToGroupPromise sqlite3 " + JSON.stringify(arguments));
    buildPromiseGetGroupById(that, group_id).then(function(group){
      console.log("group found sqlite3"  + JSON.stringify(group));
      groupfk = group.id;
      return that.readEntityPromise(entity_id, entity_type);
    }).then(function(entity){
      console.log("entity found sqlite3 " + JSON.stringify(entity));
      entityfk = buildEntityPk(entity.id, entity.type);
      console.log("putting entity "+ entityfk+ " in group "+ groupfk);
      that.store_entity_in_group_statement.run(entityfk, groupfk, function (error) {
        if (error) {
          handleError(error, reject);
        } else {
          resolve();
        }
      });
    },reject);
  });

};


SqliteStorage.prototype.listEntitiesByAttributeValueAndType = function (attribute_type, attribute_value) {
  var that = this;
  console.log("arguments for listEntitiesByAttributeTypeAndValuetity sqlite3 " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    that.get_entity__id_by_string_attribute_value_statement.all(attribute_type, attribute_value, function (error, rows) {
      if (error) {
        handleError(error, reject);
      } else if (!rows || rows.length === 0) {
        reject(createError(404, "entity with attribute  " + attribute_type + " and value " + attribute_value + " not found"));
      } else {
        console.log("found entities for listEntitiesByAttributeTypeAndValuetity sqlite3 " + JSON.stringify(rows));
        var promisses = [];
        if (rows.lengh === 0) {
          reject(createError(404, "entity with attribute  " + attribute_type + " and value " + attribute_value + " not found"));
        }
        for (var i in rows) {
          console.log('sqlite3 processing row ' + JSON.stringify(rows[i]) + " pk " + "fk_entity_pk");
          promisses.push(buildPromiseEntityByPk(that,rows[i].fk_entity_pk));
        }
        Promise.all(promisses).then(function (entities) {
          console.log('sqlite3: finished processing query by attribute type and value. resolving attribute query with  ' + JSON.stringify(entities));
          return resolve(entities);
        },function rejection(re){
          reject(re);
        }).catch(function (reason) {
          throw reason;
        });
      }
    });
  });
};

SqliteStorage.prototype.listEntitiesByGroupId = function (group_id) {
  var that = this;
  console.log("arguments for listEntitiesByGroupId sqlite3 " + JSON.stringify(arguments));
  return new Promise(function (resolve, reject) {
    console.log("executing promise for listEntitiesByGroupId sqlite3");
    buildPromiseGetGroupById(that, group_id).then(function(group){
      console.log("group found sqlite3 " + JSON.stringify(group));
      that.get_memberships_by_grouppk.all(group_id, function (error, rows) {
        if (error) {
          handleError(error, reject);
        } else if (!rows || rows.length === 0) {
          resolve([]); //NOTE this means the group exists but it is just empty
        } else {
          console.log("found entities for group sqlite3 " + JSON.stringify(rows));
          var promisses = [];
          for (var i in rows) {
            console.log('sqlite3 processing row ' + JSON.stringify(rows[i]) + " pk " + "fk_entity_pk");
            promisses.push(buildPromiseEntityByPk(that,rows[i].fk_entity_pk));
          }
          Promise.all(promisses).then(function (entities) {
            console.log('sqlite3: finished processing query by attribute type and value. resolving attribute query with  ' + JSON.stringify(entities));
            return resolve(entities);
          },function rejection(re){
            reject(re);
          }).catch(function (reason) {
            throw reason;
          });
        }
      });
    },reject);

  });
};

module.exports = SqliteStorage;
