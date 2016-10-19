const clone = require('clone');
var sqlite3 = require('sqlite3').verbose();

var  SqliteStorage = function () {
	this.READ="read";
	this.CREATE="create";
	this.UPDATE="update";
	this.DELETE="delete";
};


//create tables and prepared statements
SqliteStorage.prototype.init = function (storageConf, onCreationFinished){
	this.conf = storageConf;
	var filename = this.conf.dbName;
	this.storage = new sqlite3.Database(filename,function(error){
			if(error){
				onCreationFinished({"success":false,"error":error});
			}
			else{
				that = this;
				with(this.storage){
					serialize(function(){
						run("CREATE TABLE IF NOT EXISTS Entity (id TEXT PRIMARY KEY, type TEXT NOT NULL, owner type TEXT NOT NULL)");
						run("CREATE TABLE IF NOT EXISTS StringAttributeValue (id TEXT PRIMARY KEY, fk_entity_id TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL)");
						run("CREATE TABLE IF NOT EXISTS IntAttributeValue (id TEXT PRIMARY KEY, fk_entity_id TEXT NOT NULL, type TEXT NOT NULL, value INT NOT NULL)");
						that.delete_entity_by_id_statement = prepare("DELETE FROM Entity WHERE id = ?");
						that.delete_all_attributes_by_entity_id_statement = prepare("DELETE from IntAttributeValue WHERE fk_entity_id =?");
						that.store_int_attribute_value_statement = prepare("INSERT INTO IntAttributeValue  (id, fk_entity_id, type, value) VALUES(?, ?, ?, ?)");
						that.store_string_attribute_value_statement = prepare("INSERT INTO StringAttributeValue  (id, fk_entity_id, type, value) VALUES(?, ?, ?, ?)");
						that.get_entity_attributes_by_id_statement = prepare("SELECT type, value from StringAttributeValue WHERE fk_entity_id =$id UNION SELECT type, value from IntAttributeValue WHERE fk_entity_id =$id");
						that.get_entity_by_id_statement = prepare("SELECT * from Entity WHERE id =?");
						that.store_entity_statement = prepare("INSERT INTO Entity  (id , type, owner) VALUES(?, ?, '1')");
					});
		   }
			 onCreationFinished({"success":true});
		 }
	}.bind(this));


}

//converts the given sql-result rows to an object
function sqlRowsToObject(entity, attributes){
  var result = {};
  result["id"] = entity.id;
  result["type"] = entity.type;
  attributes.forEach(function(item){
    result[item.type] = item.value;
  });
  return result;
}

/*
Reads entity from the database and returns json
*/
SqliteStorage.prototype.readEntity = function(id, cb){
	var that = this;
  that.get_entity_by_id_statement.get(id,function(error, row){
    if(error){ cb({"success":false,"error":error});}
    else if(!row){ cb({"success":false,"error":"entity with id "+id+" not found"});}
    else{
      that.get_entity_attributes_by_id_statement.all(id, function (error, rows){
		    if(error){  cb({"success":false,"error":error});}
		    else if(!rows){ cb({"success":false,"error":"atributes for entity with id "+id+" not found"});}
		    else{
		       var data = sqlRowsToObject(row, rows)
		       cb({"success":true, "data":data});
		    }
		  });
    }
  });
}
//inserts a entity with the given id and type in the entity table. The given attributes are stored in the attributeValue table regarding to their type (int or string)
SqliteStorage.prototype.createEntity = function(id, entity_type, data, cb){
	var that = this;
	this.store_entity_statement.run(id, entity_type,function (error){
		if(error){ cb({"success":false,"error":error});}
		else{
		  that.storage.run("BEGIN", function (error){
				if(error){	cb({"success":false,"error":error});}
				else{
					for (var type in data) {
						if(typeof(data[type]) == "string")
							that.store_string_attribute_value_statement.run(id+"_"+entity_type+"_"+type, id, type, data[type]);
						else if(typeof(data[type]) == "number")
							that.store_int_attribute_value_statement.run(id+"_"+entity_type+"_"+type, id, type, data[type]);
						else
							cb({"success":false,"error":"Type not string or int: "+typeof(data[type])});
					}
					that.storage.run("COMMIT", function (error){
					  if(error){ cb({"success":false,"error":error});}
					  else{cb({"success":true, "data":clone(data)});}
				  });
				}
			});
		}
	}
 );
}



//updates the attributes of the entity with the given id
SqliteStorage.prototype.updateEntity = function(id, data, cb){
	var that =this;
	that.delete_all_attributes_by_entity_id_statement.run(id, function (error){
	  if(error){ 	cb({"success":false,"error":error});}
	  else{
	    that.storage.run("BEGIN", function (error){
				if(error){cb({"success":false,"error":error});}
				else{
					for (var type in data){
						if(typeof(data[type]) == "string")
							that.store_string_attribute_value_statement.run(id+"_"+type, id, type, data[type]);
						else if(typeof(data[type]) == "number")
							that.store_int_attribute_value_statement.run(id+"_"+type, id, type, data[type]);
						else
							cb({"success":false,"error":"Type not string or int: "+typeof(data[type])});
					}
					that.storage.run("COMMIT", 	function  (error){
						  if(error){ cb({"success":false,"error":error});}
						  else{cb({"success":true, "data":clone(data)});}
					});
				}
			});
	  }
	});
}

//deletes the entity with the given id and all its attributes
SqliteStorage.prototype.deleteEntity = function(id, cb){
	var that = this;
	that.delete_entity_by_id_statement.run(id, function (error){
		if(error){cb({"success":false,"error":error});}
		else{
		  that.delete_all_attributes_by_entity_id_statement.run(id, function(error){
					if(error){cb({"success":false,"error":error});}
					else{cb({"success":true});}
			});
		}
	});
}

SqliteStorage.prototype.crudOperation = function (id, entity_type, action, data, onCrudOperationFinished) {
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

	}
	if(action == this.READ){
		this.readEntity(id, onCrudOperationFinished);
	}
	else if(action == this.CREATE){
		this.createEntity(id,entity_type,data,onCrudOperationFinished);
	}
	else if(action == this.UPDATE){
		this.updateEntity(id,data,onCrudOperationFinished);
	}
	else if(action == this.DELETE){
		this.deleteEntity(id,onCrudOperationFinished);
	}
	else{
		var result = {"success":false,"error":"undefined type of action "+action+" for Storage"};
		onCrudOperationFinished(result);
	}
}

module.exports = SqliteStorage;
