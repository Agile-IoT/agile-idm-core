const clone = require('clone');
const createError = require('http-errors');
const console = require('../log.js');
var sqlite3 = require('sqlite3').verbose();

var  SqliteStorage = function () {

};

//create tables and prepared statements
SqliteStorage.prototype.init = function (storageConf, cb){
	var filename = storageConf.dbName;
	var that = this;
	that.storage = new sqlite3.Database(filename,function(error){
			if(error){
				//we can't recover from this...
				throw error;
			}
			else{
				with(that.storage){
					serialize(function(){
						run("CREATE TABLE IF NOT EXISTS Entity (pk TEXT PRIMARY KEY, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL, owner TEXT NOT NULL)");
						run("CREATE TABLE IF NOT EXISTS StringAttributeValue (id TEXT PRIMARY KEY, fk_entity_pk TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL)");
						run("CREATE TABLE IF NOT EXISTS IntAttributeValue (id TEXT PRIMARY KEY, fk_entity_pk TEXT NOT NULL, type TEXT NOT NULL, value INT NOT NULL)");
						that.delete_entity_by_id_statement = prepare("DELETE FROM Entity WHERE pk = ?");
						that.delete_all_int_attributes_by_entity_id_statement = prepare("DELETE from IntAttributeValue WHERE fk_entity_pk =?");
						that.delete_all_string_attributes_by_entity_id_statement = prepare("DELETE from StringAttributeValue WHERE fk_entity_pk =?");
						that.store_string_attribute_value_statement = prepare("INSERT INTO StringAttributeValue  (id, fk_entity_pk, type, value) VALUES(?, ?, ?, ?)");
					  that.store_int_attribute_value_statement = prepare("INSERT INTO IntAttributeValue  (id, fk_entity_pk, type, value) VALUES(?, ?, ?, ?)");
						that.get_entity_attributes_by_id_statement = prepare("SELECT type, value from StringAttributeValue WHERE fk_entity_pk =$pk UNION SELECT type, value from IntAttributeValue WHERE fk_entity_pk =$pk");
						that.get_entity_by_id_and_type_statement = prepare("SELECT * from Entity WHERE entity_id =? and entity_type =?");
						that.get_entity__id_by_string_attribute_value_statement = prepare("SELECT fk_entity_pk from StringAttributeValue where  type = ? and value = ?");
						that.store_entity_statement = prepare("INSERT INTO Entity  (pk , entity_id, entity_type, owner) VALUES(?, ?, ?, ?)");
					});
		   }
			 cb();
		 }
	});
}
//flatten entities for now...
function flattenEntity(data){
	if(data){
		//TODO horrible hack to keep sqlite schema simple... figure out somee day what to do...
		var d1 = clone(data);
		data = d1;
		var keys = Object.keys(data);
		for(var i in keys){
			 if(typeof(data[keys[i]]) != "number" && typeof(data[keys[i]]) != "string"){
				data[keys[i]] = JSON.stringify(data[keys[i]]);
			 }
		}
		return data;
	}
}

//converts the given sql-result rows to an object
function sqlRowsToObject(entity, attributes){
  var result = {};
  result["id"] = entity.entity_id;
  result["type"] = entity.entity_type;
	result["owner"] = entity.owner;
  attributes.forEach(function(item){
    result[item.type] = item.value;
  });
  return result;
}

/*
  resolves the entity as it is stored in the database including the id, owner and type.
*/
function storeAttributesPromise(entity_id, entity_type, owner, data, that){
	return new Promise(function(resolve,reject){
		var entity_pk = buildEntityPk(entity_id, entity_type);
		with(that){
			storage.serialize(function() {
				storage.run("BEGIN", function (error){
					console.debug('begin  creation of entity attributes transaction  for entity with id '+entity_id+" and type "+entity_type);
					if(error){	reject(createError(500,"cannot start a transaction"+error));}
					else{
						for (var type in data) {
							if(typeof(data[type]) == "string")
							 store_string_attribute_value_statement.run(buildAttributePk(entity_pk, type), entity_pk, type, data[type]);
						 else if( typeof(data[type]) == "number")
							 store_int_attribute_value_statement.run(buildAttributePk(entity_pk, type), entity_pk, type, data[type]);
						 else
							reject(createError(500,"attribute type not string or number: "+typeof(data[type])));
						}
						storage.run("COMMIT", function (error){
							 if(error){ 	reject(createError(500,"cannot commit transaction  :"+error));}
							 else{
								 console.debug('end of creation of attributes for entity with id '+entity_id+" and type "+entity_type+" and owner "+owner);
								 var result = clone(data);
								 result["id"] = entity_id;
								 result["type"] = entity_type;
								 result["owner"] = owner;
								 console.debug("return "+JSON.stringify(result));
								 resolve(result);
							 }
						 });
					}
				});
			});
		}
	});
}


function buildEntityPk(entity_id, entity_type){
	return entity_id+"_"+entity_type;
}

function buildAttributePk(entity_pk, attrubute_type){
	return entity_pk+"#"+attrubute_type;
}

//used to handle generic 500 errors
//TODO improve to split different errors... PK repeated,... etc
function handleError(error, resolve){
	console.debug('sqlite3 error ocurred '+JSON.stringify(error));
	resolve(createError(500, error.message));
}
/*
Reads entity from the database and returns json
*/
SqliteStorage.prototype.readEntityPromise = function(entity_id, entity_type){
	var that = this;
	return new Promise(function(resolve,reject){
		that.get_entity_by_id_and_type_statement.get(entity_id,entity_type,function(error, row){
	    if(error){ handleError(error, resolve);}
	    else if(!row){ reject(createError(404, "entity with id "+entity_id+" and type "+entity_type+" not found"));}
	    else{
	        that.get_entity_attributes_by_id_statement.all(row.pk, function (error, rows){
			    if(error){ handleError(error, resolve);}
			    else if(!rows){ reject(createError(404, "attributes for entity with id "+entity_id+"and type "+entity_type+" not found"));}
			    else{
			       var data = sqlRowsToObject(row, rows)
			       resolve(data);
			    }
			  });
	    }
	  });
	});

}
//inserts a entity with the given id and type in the entity table. The given attributes are stored in the attributeValue table regarding to their type (int or string)
SqliteStorage.prototype.createEntityPromise = function(entity_id, entity_type, owner, data){
  var that = this;
	return new Promise(function(resolve,reject){
		data = flattenEntity(data);
		with(that){
			 var entity_pk = buildEntityPk(entity_id, entity_type);
			 store_entity_statement.run(entity_pk,entity_id, entity_type, owner, function (error){
				 if(error){ handleError(error, resolve);}
				 else{
			     storeAttributesPromise(entity_id, entity_type, owner, data,that).then(resolve,reject);
			   }
			});
		}
	});
};



//updates the attributes of the entity with the given id
SqliteStorage.prototype.updateEntityPromise = function(entity_id,  entity_type, data){
	console.debug("arguments for updateEntity sqlite3 "+JSON.stringify(arguments));
	var that = this;
	var result;
	return new Promise(function(resolve,reject){
		that.readEntityPromise(entity_id, entity_type)
		  .then(function (res){
				result = res;
				console.debug("entity for update found "+JSON.stringify(result));
				data = flattenEntity(data);
				with(that){
					 var entity_pk = buildEntityPk(entity_id, entity_type);
					 delete_all_int_attributes_by_entity_id_statement.run(entity_pk, function (error){
						 if(error){ handleError(error, resolve);}
						 else{
							 delete_all_string_attributes_by_entity_id_statement.run(entity_pk, function (error){
	 								 console.debug("update for entity with id "+entity_id+" and type "+entity_type+". Old attributes are deleted");
	 								if(error){ handleError(error, resolve);}
	 								else{
	 									console.debug("update for entity with id "+entity_id+" and type "+entity_type+". creating new values of attributes");
	 									storeAttributesPromise(entity_id, entity_type, result.owner, data,that).then(resolve,reject);
	 								}
	 						});
						 }
					});
				}
			},reject);
		});
}

//deletes the entity with the given id and all its attributes
SqliteStorage.prototype.deleteEntityPromise = function(entity_id, entity_type){
	console.debug("arguments for deleteEntity sqlite3 "+JSON.stringify(arguments));
	var that = this;
	var result;
	return new Promise(function(resolve,reject){
		that.readEntityPromise(entity_id, entity_type)
		  .then(function (res){
				result = res;
				console.debug("entity for delete found "+JSON.stringify(result));
				with(that){
					 var entity_pk = buildEntityPk(entity_id, entity_type);
					 delete_all_int_attributes_by_entity_id_statement.run(entity_pk, function (error){
						 if(error){ handleError(error, resolve);}
						 else{
							 delete_all_string_attributes_by_entity_id_statement.run(entity_pk, function (error){
	 								console.debug("Delete for entity with id "+entity_id+" and type "+entity_type+". Old attributes are deleted");
	 								if(error){ handleError(error, resolve);}
	 								else{
	 									console.debug("Delete for entity with id "+entity_id+" and type "+entity_type);
										delete_entity_by_id_statement.run(entity_pk,function (error){
										  if(error){ handleError(error, resolve);}
											else {
												 resolve();
											}
										});

	 								}
	 						});
						 }
					});
				}
			},reject);
		});


}

SqliteStorage.prototype.listEntitiesByAttributeTypeAndValue = function(attribute_type, attribute_value){

}

module.exports = SqliteStorage;
