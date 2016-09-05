var Validator = require('jsonschema').Validator;
var v = new Validator();


// ------------------------- validate module -------------------------------------------

var MyModule = function (conf) {

	if(conf.hasOwnProperty("schema-validation")){
	  var schemas =conf["schema-validation"];
		for(var i in schemas){
			v.addSchema(schemas[i],schemas[i]['id']);
		}
	}
	else {
		throw new Error("Validator module not property configured!");
	}
};


MyModule.prototype.validatePromisse = function (entity_type, data) {
	var promisse = new Promise(function (resolve, reject){
			try{
				var resultvalid = v.validate(data, entity_type);
				if(resultvalid.errors.length == 0){
					return resolve();
				}
				else{
					var array = [];
					for(var i in resultvalid.errors){
					    array.push(resultvalid.errors[i].property+" "+resultvalid.errors[i].message );
					}
					return reject(new Error(JSON.stringify(array)));
				}

			}catch(error){
				return  reject(error);
			}

	});
	return promisse;

}

module.exports = MyModule;
