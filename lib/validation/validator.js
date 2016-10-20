var Validator = require('jsonschema').Validator;
var v = new Validator();

// ------------------------- validate module -------------------------------------------

var MyModule = function (conf) {
	if(conf.hasOwnProperty("schema-validation")){
	  var schemas = conf["schema-validation"];
		for(var i in schemas){
			v.addSchema(schemas[i],schemas[i]['id']);
		}
	} else {
		throw new Error("Validator module not property configured!");
	}
};


MyModule.prototype.validatePromise = function (entity_type, data) {
	return new Promise(function (resolve, reject) {
		try {
			var resultvalid = v.validate(data, entity_type);
			if (resultvalid.errors.length == 0) {
				return resolve();
			} else {
				var array = [];
				for (var i in resultvalid.errors) {
					array.push(resultvalid.errors[i].property + " " + resultvalid.errors[i].message);
				}
				return reject(createError(400,"wrong entity format (or unexisting type of entity) "+JSON.stringify(array)));
			}

		} catch (error) {
			return reject(createError(500,"unexpected validation error"+error));
		}
	});
};

module.exports = MyModule;
