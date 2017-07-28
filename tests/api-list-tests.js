var IdmCore = require('../index');
var clone = require('clone');
var assert = require('assert');
var deepdif = require('deep-diff');
var createError = require('http-errors');
var fs = require('fs');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var db;
//conf for the API (components such as storage and authentication for the API may be replaced during tests)
var dbName = "./database";
var rmdir = require('rmdir');
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
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "token": {
        "type": "string"
      }
    },
    "required": ["name"]
  }, {
    "id": "/other",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "token": {
        "type": "string"
      }
    },
    "required": ["name"]
  }]
};

//default data for the tests
var token = "6328602477442473";
var user_info = {
  id: "6328602477442473!@!auth_type",
  entity_type: "/user",
  user_name: "6328602477442473",
  auth_type: "auth_type",
  owner: "6328602477442473!@!auth_type"
};

var action = "create";
var entity_type = "/sensor";
var entity_id = "323";
var entity_1 = {
  "name": "Barack Obam2a",
  "token": "DC 20500"
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
  canDeleteAttribute: function (userInfo, entities, attributeName, attributeValue) {
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

//Tests!
describe('List Apis', function () {

  describe('#list entities by entity type', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when there is no entity in the database', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
      idmcore.listEntitiesByEntityType("something")
        .then(function (read) {
          if (read instanceof Array && read.length == 0)
            done();
        }, function handlereject(error) {

        }).catch(function (err) {
          throw err;
        });

    });

    it('should get an entity based on its type', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
      var entity = clone(entity_1);
      var entity2 = clone(entity_1);
      var lookedfor = "123123";
      entity2.token = lookedfor;
      idmcore.createEntity(user_info, entity_id, entity_type, entity2)
        .then(function (data) {
          if (entity_id == data.id && entity_type == data.type && data.owner == token + "!@!" + "auth_type") {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity2) == undefined)
              return idmcore.createEntity(user_info, "someotherid", "/other", entity)
          }
        }).then(function (data) {
          if ("someotherid" === data.id && "/other" === data.type && data.owner == token + "!@!" + "auth_type") {
            delete data.id;
            delete data.type;
            delete data.owner;
            if (deepdif.diff(data, entity) == undefined)
              return idmcore.listEntitiesByEntityType(user_info, entity_type);
          }
        }).then(function (list) {
          //console.log("res" + JSON.stringify(list))
          if (list.length == 1) {
            var data = list[0];
            if (data.token == lookedfor && entity_id == data.id && entity_type == data.type && data.owner == token + "!@!" + "auth_type") //more detailed checks in cases when there is only one or more are executed in the sqlite3 tests
              done();

          }
          //return idmcore.readEntity(token, entity_id, entity_type);
        }).then(function (read) {

        }, function handlereject(error) {
          throw error;
        }).catch(function (err) {
          throw err;
        });
    });

  });

  describe('#ListGroups()', function () {

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when group is not there', function (done) {
      var idmcore = new IdmCore(conf);
      var owner = token + "!@!" + "auth_type";
      idmcore.setMocks(null, null, PdpMockOk, dbconnection, pepMockOk);
      idmcore.readGroups(user_info)
        .then(function (read) {
          if (read.length === 0) {
            done();
          }
        }, function handlereject(error) {

        }).catch(function (err) {
          throw err;
        });

    });

    it('should return a  group after its creation', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(null, null, PdpMockOk, dbconnection);
      var entity = clone(entity_1);
      var owner = token + "!@!" + "auth_type";
      var group_name = "mygroup";
      idmcore.createGroup(user_info, group_name)
        .then(function (data) {
          if (group_name === data.group_name && data.owner === owner) {
            return idmcore.readGroups(user_info);
          }
        }).then(function (reads) {
          var read = reads[0];
          if (group_name == read.group_name && read.owner === owner) {
            done();
          }
        }, function handlereject(r) {
          throw r;
        }).catch(function (err) {
          throw err;
        });
    });

    it('should return all  groups ', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(null, null, PdpMockOk, dbconnection);
      var entity = clone(entity_1);
      var owner = token + "!@!" + "auth_type";
      var group_name = "mygroup";
      var group_name2 = "mygroup2";
      Promise.all([idmcore.createGroup(user_info, group_name), idmcore.createGroup(user_info, group_name2)])
        .then(function (r) {

          if (group_name === r[0].group_name && r[0].owner === owner &&
            group_name2 === r[1].group_name && r[1].owner === owner) {
            return idmcore.readGroups(user_info);
          }
        }).then(function (reads) {
          if (group_name == reads[0].group_name && reads[0].owner === owner &&
            group_name2 == reads[1].group_name && reads[1].owner === owner) {
            done();
          }
        }, function handlereject(r) {
          throw r;
        }).catch(function (err) {
          throw err;
        });
    });
  });

});
