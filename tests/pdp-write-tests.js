var IdmCore = require('../index');
var dbconnection = require('agile-idm-entity-storage').connectionPool;
var rmdir = require('rmdir');
var fs = require('fs');
var clone = require('clone');
//{"target":{"type":"user"},"locks":[{"path":"hasId","args":["$owner"]}]
var dbName = "./database_";
var conf = {
  "storage": {
    "dbName": dbName
  },
  "upfront": {
    pdp: {
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
        //fix this two eventually...
        locks: "./node_modules/UPFROnt/example/online/Locks/",
        actions: "./node_modules/UPFROnt/example/online/Actions"
      }
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
        collection: "policies",
        // specifies whether the module should check
        // the cache to fetch a policy, of course,
        // this may induce additional lookups but on
        // average using the cache is recommended
        cache: {
          enabled: false,
          TTL: 600,
          pubsub: {
            type: "redis",
            channel: "policyUpdates"
          }
        }
      }
    }
  },
  "policies": {
    "create_entity_policy": [
      // actions of an actor are not restricted a priori
      {
        target: {
          type: "/any"
        }
      }, {
        source: {
          type: "/any"
        }
      }
    ],
    "top_level_policy": {
      flows: [
        // all properties can be read by everyone
        {
          target: {
            type: "/any"
          }
        },
        // all properties can only be changed by the owner of the entity
        {
          source: {
            type: "/user"
          },
          locks: [{
            lock: "isOwner"
          }]
        },
        {
          source: {
            type: "/user"
          },
          locks: [{
            lock: "attrEq",
            args: ["role", "admin"]
          }]
        }

      ],
      actions: [{
        name: "delete"
      }]
    },
    "attribute_level_policies": {
      "user": {
        "password": [
          // the property can only be read by the user itself
          {
            target: {
              type: "/user"
            },
            locks: [{
              lock: "isOwner"
            }]
          },
          // the property can be set by the user itself and
          {
            source: {
              type: "/user"
            },
            locks: [{
              lock: "isOwner"
            }]
          },
          // by all users with role admin
          {
            source: {
              type: "/user"
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
              type: "/any"
            }
          },
          // can only be changed by users with role admin
          {
            source: {
              type: "/user"
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
              type: "/user"
            },
            locks: [{
              lock: "isOwner"
            }]
          },
          // the property can be set by the user itself and
          {
            source: {
              type: "/user"
            },
            locks: [{
              lock: "isOwner"
            }]
          },
          // by all users with role admin
          {
            source: {
              type: "/user"
            },
            locks: [{
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

//override this object to get the pap for creating the fist user.
IdmCore.prototype.getPap = function () {
  return this.pap;
};

IdmCore.prototype.getStorage = function () {
  return this.storage;
}

var idmcore = new IdmCore(conf);

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

function buildUsers(done) {

  var arr = [idmcore.getPap().setEntityPolicies(admin_auth.id, admin_auth.type),
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

//default data for the tests
var token = "6328602477442473";
var user_info = {
  "user_name": "alice",
  "auth_type": "agile-local",
  "password": "secret",
  "role": "student",
  "owner": "alice!@!agile-local"
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

describe('Api (PEP Write Test)', function () {

  describe('#createEntity()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should reject with 403 and conflicts array in the object when attempting to create an entity without the proper role', function (done) {

      var entity_id = "1";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(user_info_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          throw new Error("unexpected. user not admin can create users!");
        }, function handlereject(error) {
          if (error.statusCode === 403 && error.conflicts.length > 0)
            done();
        });
    });

    it('should resolve with the entity when  attempting to create an entity with the proper role', function (done) {
      var entity_id = "1";
      var owner = "username!@!some-type";
      var entity_type = "/user";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          done();
        }, function handlereject(error) {
          throw error;
        });

    });
  });

  describe('#setAttribute()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {

      cleanDb(done);
    });

    it('should reject with 403 and conflicts array when attempting to update  an entity\'s attribute without the proper role and not owner', function (done) {
      var entity_id = "1234";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.setEntityAttribute(user_info_auth, entity_id, entity_type, "role", "admin");
        }).then(function () {
          throw new Error("unexpected... the user can set the role without being admin!");
        }, function handlereject(error) {
          if (error.statusCode == "403" && error.conflicts.length > 0)
            done();
        });
    });

    it('should reject with 403 and conflicts array when an owner (non-admin) attempts to update  his own role', function (done) {
      var entity_id = "1234";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.setEntityAttribute(res, entity_id, entity_type, "role", "admin");
        }).then(function () {
          throw new Error("unexpected... the user can set the role without being admin!");
        }, function handlereject(error) {
          if (error.statusCode == "403" && error.conflicts.length > 0)
            done();
        });
    });

    it('should resolve  when attempting to update  an entity attribute with the proper role', function (done) {
      var entity_id = "1";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.setEntityAttribute(admin_auth, entity_id, entity_type, "role", "admin");
        }).then(function () {
          done();
        }, function handlereject(error) {
          throw error;
        });
    });

  });

  describe('#deleteEntityAttribute()', function () {

    beforeEach(function (done) {
      buildUsers(done);
    });

    afterEach(function (done) {

      cleanDb(done);
    });

    it('should resolve  when attempting to update  an entity attribute with the proper role', function (done) {
      var entity_id = "1";
      var entity_type = "/user";
      var owner = "username!@!some-type";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (res) {
          return idmcore.deleteEntityAttribute(admin_auth, entity_id, entity_type, "password");
        }).then(function (res) {
          return idmcore.readEntity(admin_auth, res.id, res.type);
        }).then(function (res) {
          if (!res.hasOwnProperty("password"))
            done();
        }, function handlereject(error) {
          throw error;
        });
    });
  });

});
