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
      }, {
        source: {
          type: "user"
        },
        locks: [{
          lock: "attrEq",
          args: ["role", "admin"]
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
      },
      "role":{
        "type":"string"
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
          done();
        });
      });
    }, function () {
      throw Error("not able to close database");
    });
  }
  //if there is a policy file delete it
  fs.exists(conf.policies.dbName, function (exists) {
    if (exists) {
      fs.unlink(conf.policies.dbName, function () {
        disconnect(c);
      });
    } else {
      disconnect(c);
    }
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

describe('Api (PEP Read test)', function () {

  describe('#readEntity()', function () {

    beforeEach(function (done) {
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
        })
    });

    afterEach(function (done) {
      cleanDb(done);
    });

    it('should resolve with a declassified entity for different users (password not there)', function (done) {

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
          return idmcore.readEntity(user_info_auth, res.id, res.type);
        }).then(function (read) {
          if (read.hasOwnProperty("password")) {
            throw new Error("entity not properly declassified!");
          } else
            done();
        }, function handlereject(error) {
          throw error;
        });
    });

    it('should resolve with the complete entity when the owner reads it', function (done) {
      var entity_id = "1";
      var owner = "username!@!some-type";
      var entity_type = "/user";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      idmcore.setMocks(null, null, null, dbconnection);
      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, user_info_auth.owner)
        .then(function (res) {
          return idmcore.readEntity(user_info_auth, res.id, res.type);
        }).then(function (data) {
          if (!data.hasOwnProperty("password")) {
            throw new Error("entity wrongly declassified, an entity was removed when it should not have been removed!");
          } else {
            done();
          }
        }, function handlereject(error) {
          throw error;
        });

    });

    it('should resolve with the entity when attempting to create an entity with the proper role', function (done) {
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

  describe('#findEntitiesByAttribute()', function () {

    beforeEach(function (done) {
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
        })
    });

    afterEach(function (done) {

      cleanDb(done);
    });

    it('should resolve with an array without entities for which the attributes used in the query are not allowed to be read by the policy', function (done) {
      var entity_id = "1";
      var owner = "username!@!some-type";
      var entity_type = "/user";
      var entity = {
        "user_name": "username",
        "auth_type": "some-type",
        "password": "value"
      }
      var new_user_auth;
      idmcore.setMocks(null, null, null, dbconnection);

      idmcore.createEntityAndSetOwner(admin_auth, entity_id, entity_type, entity, owner)
        .then(function (user) {
          new_user_auth = user;
          var criteria = [{
            attribute_type: "password",
            attribute_value: "secret"
          }];
          var queries = [idmcore.listEntitiesByAttributeValueAndType(admin_auth, criteria),
            idmcore.listEntitiesByAttributeValueAndType(user_info_auth, criteria),
            idmcore.listEntitiesByAttributeValueAndType(new_user_auth, criteria)
          ];
          return Promise.all(queries);
        })
        .then(function (results) {
          console.log("res :" + JSON.stringify(results));

          if (results[0].length === 1 && admin_auth.id == results[0][0].id && //admin can only see his password
            results[1].length === 1 && user_info_auth.id == results[1][0].id && //oehter user can only see his password
            results[2].length === 0 //this user cannot see anything because eventhough he asked for the right password for other users, he doesn;t have access, and his password doesn't match
          )
            done();
          else
            throw new Error("unexpected result, should only see its own passowrd");
        }, function handlereject(error) {
          throw error;
        });
    });
  });

});
