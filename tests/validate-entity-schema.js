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
  "upfront": {
    ulocks: {
      entityTypes: {
        "/any": 0,
        "/group": 1,
        "/user": 2,
        "/sensor": 3,
        "/client": 4,
        "/api": 5,
        "/const": 6,
        "/attr": 6,
        "/prop": 6,
        "/var": 6,
      },
      opTypes: {
        write: 0,
        read: 1
      },
      //fix this two eventually...
      locks: "./node_modules/agile-policies/node_modules/UPFROnt/ulocks/Locks",
      actions: "./node_modules/agile-policies/node_modules/UPFROnt/ulocks/Actions"
      /*locks: "./node_modules/UPFROnt/example/online/Locks/",
      actions: "./node_modules/UPFROnt/example/online/Actions"*/
    },
    pdp: {

    },
    pap: {
      // this specifies host, port and path where
      // this module should wait for requests
      // if specified, the module runs as a PAP server
      // if undefined, the module runs as a PAP client
      // accessing another PAP server
      /*server: {
          "host": "localhost",
          port: 1234,
          path: "/pap/",
          tls: false,
          cluster: 1
      },*/
      // storage specifies where the policies
      // are stored persistently:
      // 1. if policies are stored remotely
      // in another PAP, specify as type "remote"
      // and indicate host, port and path
      // 2. if policies are stored locally
      // in a database, specify the db module
      // ("mongodb", tbd) and the hostname and
      // port
      // thus, specifying type "remote" and specifying
      // api yields an invalid configuration
      storage: {
        module_name: "agile-upfront-leveldb",
        type: "external",
        dbName: "./pap-database",
        collection: "policies"
      }
    }
  },
  "policies": {
    "create_entity_policy": [
      // actions of an actor are not restricted a priori
      {
        op: "write"
      },
      {
        op: "read"
      }
    ],
    "top_level_policy": {
      flows: [
        // all properties can be read by everyone
        {
          op: "read"
        },
        // all properties can only be changed by the owner of the entity
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "isOwner"
          }]
        },
        {
          op: "write",
          locks: [{
            lock: "hasType",
            args: ["/user"]
          }, {
            lock: "attrEq",
            args: ["role", "admin"]
          }]
        }
      ],
      //specify what should happen if the policy does not comply
      actions: {
        "read": [{
          action: "delete"
        }]
      }
    },
    "attribute_level_policies": {
      "user": {
        "password": [
          // the property can only be read by the user itself
          {
            op: "read",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          }
          // the property can be set by the user itself and
          , {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          },
          // by all users with role admin
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "attrEq",
              args: ["role", "admin"]
            }]
          }
        ],
        "role": [
          // can be read by everyone
          {
            op: "read"
          },
          // can only be changed by users with role admin
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
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
            op: "read",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          },
          // the property can be set by the user itself and
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "isOwner"
            }]
          },
          // by all users with role admin
          {
            op: "write",
            locks: [{
              lock: "hasType",
              args: ["/user"]
            }, {
              lock: "attrEq",
              args: ["role", "admin"]
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
    "additionalProperties": false,
    "properties": {
      "user_name": {
        "type": "string"
      },
      "auth_type": {
        "type": "string"
      },
      "password": {
        "type": "string"
      },
      "role": {
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



var pepMockOk = {
  declassify: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      resolve(entityInfo);
    });
  },
  declassifyArray: function (userInfo, array) {
    return new Promise(function (resolve, reject) {
      resolve(array);
    });
  }
};

function cleanDb(c) {
  //disconnect in any case.
  function disconnect(done) {
    dbconnection("disconnect").then(function () {
      rmdir(dbName + "_entities", function (err, dirs, files) {
        rmdir(dbName + "_groups", function (err, dirs, files) {
          db = null;
          rmdir(conf.upfront.pap.storage.dbName + "_policies", function (err, dirs, files) {
            done();
          });
        });
      });
    }, function () {
      throw Error("not able to close database");
    });
  }
  disconnect(c);
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
  },
  canWriteToAllAttributes: function (userInfo, entityInfo) {
    return new Promise(function (resolve, reject) {
      //console.log('resolving with entities '+JSON.stringify(entities));
      resolve();
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
      idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
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
      idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
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
    idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
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
