var IdmCore = require('../index');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var fs = require('fs');

//{"target":{"type":"user"},"locks":[{"path":"hasId","args":["$owner"]}]
var dbName = "./database_";
var conf = {
  "storage": {
    "dbName": dbName
  },
  "policies": {
    "dbName": "./policies.json",
    "create_entity_policy": [
      // actions of an actor are not restricted a priori
      {
        target: {
          type: "any"
        }
      }, {
        source: {
          type: "any"
        }
      }
    ],
    "top_level_policy": [
      // all properties can be read by everyone
      {
        target: {
          type: "any"
        }
      },
      // all properties can only be changed by the owner of the entity
      {
        source: {
          type: "user"
        },
        locks: [{
          lock: "isOwner"
        }]
      }
    ],
    "attribute_level_policies": {
      "user": {
        "password": [
          // the property can only be read by the user itself
          {
            target: {
              type: "user"
            },
            locks: [{
              lock: "isOwner"
            }]
          },
          // the property can be set by the user itself and
          {
            source: {
              type: "user"
            },
            locks: [{
              lock: "isOwner"
            }]
          },
          // by all users with role admin
          {
            source: {
              type: "user"
            },
            locks: [{
              lock: "attrEq",
              args: ["role", "admin"]
            }]
          }
        ],
        "role": [
          // can be read by everyone
          {
            target: {
              type: "any"
            }
          },
          // can only be changed by users with role admin
          {
            source: {
              type: "user"
            },
            locks: [{
              lock: "attrEq",
              args: ["role", "admin"]
            }]
          }
        ]
      },
      "sensor": {
        "credentials": [
          // the property can only be read by the user itself
          {
            target: {
              type: "user"
            },
            locks: [{
              lock: "isOwner"
            }]
          },
          // the property can be set by the user itself and
          {
            source: {
              type: "user"
            },
            locks: [{
              lock: "isOwner"
            }]
          }
        ]
      }

    }
  },
  "schema-validation": [{
    "id": "/sensor",
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "credentials": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "system": {
              "type": "string"
            },
            "value": {
              "type": "string"
            }
          }
        }
      }
    },
    "required": ["name"]
  }, {
    "id": "/user",
    "type": "object",
    "properties": {
      "user_name": {
        "type": "string"
      },
      "auth_type": {
        "type": "string"
      },
      "password": {
        "type": "string"
      }
    },
    "required": ["user_name", "auth_type"]
  }, {
    "id": "/client",
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "clientSecret": {
        "type": "string"
      },
      "redirectURI": {
        "type": "string"
      }
    },
    "required": ["name", "clientSecret", "redirectURI"]
  }]
};

function cleanDb(done) {
  dbconnection("disconnect").then(function () {
    rmdir(dbName + "_entities", function (err, dirs, files) {
      rmdir(dbName + "_groups", function (err, dirs, files) {
        db = null;
        done();
      });
    });
  }, function () {
    throw Error("not able to close database");
  });
}

var PdpMockOk = {
  canRead: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  canDelete: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  canReadArray: function (userInfo, entities) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve(entities);
    });
  },
  canWriteToAttribute: function (userInfo, entities, attributeName, attributeValue) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve();
    });
  },
  canUpdate: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve(entityInfo);
    });
  }

};

//default data for the tests
var token = "6328602477442473";
var user_info = {
  id: "6328602477442473!@!auth_type",
  entity_type: "/User",
  user_name: "6328602477442473",
  auth_type: "auth_type",
  owner: "6328602477442473!@!auth_type"
};

describe('Api (Validation test)', function () {

  describe('#createEntity()', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 400 when an entity with a non-existing kind of entity is passed', function (done) {
      var idmcore = new IdmCore(conf);
      var entity_id = "1";
      var entity_type = "/non-existent";
      var entity = {};
      idmcore.setMocks(null, null, PdpMockOk, dbconnection);
      idmcore.createEntity(user_info, entity_id, entity_type, entity)
        .then(function (read) {
          throw new Error('unexpec')
        }, function handlereject(error) {
          if (error.statusCode == "400" && error.message.indexOf("SchemaError") > 0) {
            done();
          }
        });
    });

    it('should create an entity when an entity a proper type and schema are provided', function (done) {
      var idmcore = new IdmCore(conf);
      var entity_id = "1";
      var entity_type = "/user";
      var entity = {
        "user_name": "some-id",
        "auth_type": "some-type"

      }
      idmcore.setMocks(null, null, PdpMockOk, dbconnection);
      idmcore.createEntity(user_info, entity_id, entity_type, entity)
        .then(function (res) {
          done();
        }, function handlereject(error) {
          throw new Error("unexpected error " + error);
        });
    });

  });

  it('should reject with 400 an entity when with an existing type but with an attribute missing ', function (done) {
    var idmcore = new IdmCore(conf);
    var entity_id = "1";
    var entity_type = "/user";
    var entity = {
      "user_name1": "some-id",
      "auth_type": "some-type"

    }
    idmcore.setMocks(null, null, PdpMockOk, dbconnection);
    idmcore.createEntity(user_info, entity_id, entity_type, entity)
      .then(function (res) {
        throw new Error("unexpected " + res);
      }, function handlereject(error) {
        if (error.statusCode == 400) {
          done();
        }
      });

  });

});
