var IdmCore = require('../index');
var clone = require('clone');
var assert = require('assert');
var deepdif = require('deep-diff');
var createError = require('http-errors');
var fs = require('fs');
var dbconnection = require('agile-idm-entity-storage').connectionPool;

/*
  This tests use (some policies). sometimes admin or another kind of user, although policies for the
  second kind of user are not really thoroughly checked.

  The main difference between this and the test file without the -policies ending is that
  this one uses the PDP, PEP and PAP to execute the same API calls.

  For tests regarding just PDP and PEP decisions check pdp-*-tests


*/

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
      locks: "./node_modules/UPFROnt//ulocks/Locks",
      actions: "./node_modules/UPFROnt/ulocks/Actions"
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

//override this object to get the pap for creating the fist user.
IdmCore.prototype.getPap = function () {
  return this.pap;
};

IdmCore.prototype.getStorage = function () {
  return this.storage;
}

var idmcore = new IdmCore(conf);

//default data for the tests
var token = "6328602477442473";
var action = "create";
var entity_type = "/sensor";
var entity_id = "323";
var entity_1 = {
  "name": "Barack Obam2a",
  "token": "DC 20500"
};
var group_name = "group";

function cleanDb(c) {
  //disconnect in any case.
  function disconnect(done) {
    dbconnection("disconnect").then(function () {
      rmdir(dbName + "_entities", function (err, dirs, files) {
        rmdir(dbName + "_groups", function (err, dirs, files) {
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

var user_info = {
  user_name: "6328602477442473",
  auth_type: "auth_type",
  owner: "6328602477442473!@!auth_type"
};

var user_info_auth = clone(user_info);
user_info_auth.id = "alice!@!agile-local";
user_info_auth.type = "/user";

var admin = {
  "user_name": "bob",
  "auth_type": "agile-local",
  "password": "secret",
  "role": "admin",
  "owner": "bob!@!agile-local"
};

var admin_auth = clone(admin);
admin_auth.id = "bob!@!agile-local";
admin_auth.type = "/user";

function buildUsers(done) {

  var arr = [idmcore.getPap().setDefaultEntityPolicies(admin_auth.id, admin_auth.type),
    idmcore.getStorage().createEntity(admin_auth.id, admin_auth.type, admin_auth.id, admin_auth)
  ];
  Promise.all(arr)
    .then(function () {
      //  we need to set owner by hand, because admin needs to be able to write to role (i.e. he has role admin)
      //  this is required when admin tries to create new admin users *but still, they own themselves*
      return idmcore.createEntityAndSetOwner(admin_auth, user_info_auth.id, user_info_auth.type, user_info, user_info_auth.id);
    }).then(function () {
      done();
    }, function (err) {
      throw err;
    });
}

//Tests!
describe('Groups Api with policies', function () {

  describe('#createGroup  and readGroup()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when group is not there', function (done) {

      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.readGroup(admin_auth, group_name, admin_auth.id)
        .then(function (read) {
          throw new Error("it seems something was found? " + JSON.stringify(read));
        }, function handlereject(error) {
          if (error.statusCode === 404) {
            done();
          } else {
            throw new Error("unexpected error " + error);
          }
        }).catch(function (err) {
          throw err;
        });

    });

    it('should create a group by id and return the same afterwards', function (done) {

      idmcore.setMocks(null, null, null, dbconnection);
      var entity = clone(entity_1);
      idmcore.createGroup(admin_auth, group_name)
        .then(function (data) {
          if (group_name === data.group_name && data.owner === admin_auth.id) {
            return idmcore.readGroup(user_info_auth, group_name, admin_auth.id);
          }
        }).then(function (read) {
          if (group_name == read.group_name && read.owner === admin_auth.id) {
            done();
          }
        }, function handlereject(r) {
          throw r;
        }).catch(function (err) {
          throw err;
        });
    });
  });

  describe('#delete and read Group()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when attemtpting to delete data is not there', function (done) {

      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.deleteGroup(admin_auth, group_name, "unesistent owner")
        .then(function (read) {}, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        }).catch(function (err) {
          throw err;
        });
    });

    it('should delete a group  by id', function (done) {

      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.createGroup(admin_auth, group_name)
        .then(function (data) {
          if (group_name === data.group_name && data.owner === admin_auth.id)
            return idmcore.deleteGroup(admin_auth, group_name, admin_auth.id);
        }).then(function () {
          return idmcore.readGroup(admin_auth, group_name, admin_auth.id);
        }).then(function () {
          throw new Error("should not return anything");
        }, function handlereject(error) {
          if (error.statusCode === 404) {
            done();
          } else {
            console.log("unexpected error" + error.statusCode);
            throw error;
          }

        });

    });
  });

  describe('#add entity to group', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 404 error when attempting to add a non existing entity to a group', function (done) {

      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.createGroup(admin_auth, group_name)
        .then(function (read) {
          return idmcore.addEntityToGroup(admin_auth, group_name, admin_auth.id, entity_id, entity_type);
        }).then(function (res) {

        }, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        });
    });

    it('should reject with 404 error when attempting to add an exiting entity to a non existing group', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.createEntity(admin_auth, entity_id, entity_type, entity_1)
        .then(function (read) {
          return idmcore.addEntityToGroup(admin_auth, group_name, admin_auth.id, entity_id, entity_type);
        }).then(function (res) {

        }, function handlereject(error) {
          if (error.statusCode == 404) {
            done();
          }
        });
    });

    it('should resolve with a modified entity after adding it to a gorup', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      var ps = [idmcore.createEntity(admin_auth, entity_id, entity_type, entity_1), idmcore.createGroup(admin_auth, group_name)];
      Promise.all(ps)
        .then(function (read) {
          return idmcore.addEntityToGroup(admin_auth, group_name, admin_auth.id, entity_id, entity_type);
        }).then(function (res) {
          return idmcore.readEntity(admin_auth, entity_id, entity_type);
        }).then(function (entityFinal) {
          if (entityFinal.groups.filter(function (v) {
              return (group_name === v.group_name && v.owner === admin_auth.id);
            }).length === 1)
            done();
        }, function handlereject(error) {});
    });

  });

  describe('#remove entity from a  group', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 409 error when attempting to remove a non existing entity from a group', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.createGroup(admin_auth, group_name)
        .then(function (read) {
          return idmcore.removeEntityFromGroup(admin_auth, group_name, admin_auth.id, entity_id, entity_type);
        }).then(function (res) {

        }, function handlereject(error) {
          if (error.statusCode == 409) {
            done();
          }
        });
    });

    it('should reject with 404 error when attempting to remove an exiting entity from a non existing group', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      idmcore.createEntity(admin_auth, entity_id, entity_type, entity_1)
        .then(function (read) {
          return idmcore.removeEntityFromGroup(admin_auth, group_name, admin_auth.id, entity_id, entity_type);
        }).then(function (res) {

        }, function handlereject(error) {

          if (error.statusCode == 404) {
            done();
          } else {
            throw new Error('found unexpected error' + error);
          }

        });
    });

    it('should resolve with a modified entity without the group  after removing the entity from a gorup where it was', function (done) {
      idmcore.setMocks(null, null, null, dbconnection, null);
      var ps = [idmcore.createEntity(admin_auth, entity_id, entity_type, entity_1), idmcore.createGroup(admin_auth, group_name)];
      Promise.all(ps)
        .then(function (read) {
          return idmcore.addEntityToGroup(admin_auth, group_name, admin_auth.id, entity_id, entity_type);
        }).then(function (res) {
          return idmcore.readEntity(admin_auth, entity_id, entity_type);
        }).then(function (entityFinal) {
          if (entityFinal.groups.filter(function (v) {
              return (group_name === v.group_name && v.owner === admin_auth.id);
            }).length === 1)
            return idmcore.removeEntityFromGroup(admin_auth, group_name, admin_auth.id, entity_id, entity_type);
        }).then(function () {
          return idmcore.readEntity(user_info_auth, entity_id, entity_type);
        }).then(function (entityFinal) {
          if (!entityFinal.hasOwnProperty('groups'))
            done();
          else {
            throw new Error("unexptecter result after deleting entity from group " + JSON.stringify(entityFinal));
          }
        }, function handlereject(error) {
          console.log("unexpecterd error: " + error);
          throw error;
        });
    });

  });
});
