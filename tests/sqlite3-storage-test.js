var assert = require('assert');
var deepdif = require('deep-diff');
var clone = require('clone');
var Sqlite3Storage = require('../lib/storage/sqlite3-storage.js');
var fs = require("fs");
var dbName = "database.db";

describe('Sqlite3Storage', function () {
  describe('#read and create Entity()', function () {
    //called after each test to delete the database
    afterEach(function () {

      if (fs.existsSync(dbName))
        fs.unlinkSync(dbName);

    });

    it('should reject with 404 error when data is not there', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      storage.init(storeConf, function () {
        storage.readEntityPromise("unexistent-stuff", "user")
          .then(function (result) {
            throw Error("should not give results");
          }, function reject(error) {
            if (error.statusCode == 404) {
              done();
            }
          });
      });
    });

    it('should return the  data by an id, if it has been previously stored', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "data": "string",
        "item": 123
      };
      storage.init(storeConf, function () {
        var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
        p.then(function (d) {
          storage.readEntityPromise(entity_id, entity_type)
            .then(function (result) {
              if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
                delete result.id; //id is included so remove it to check
                delete result.type; //entity type is included so remove it to check
                delete result.owner; //owner is included so remove it to check
                if (deepdif.diff(data, result) == undefined)
                  done();
              }
            });
        }, function rej(r) {
          console.error('a' + r);
          throw r;
        })
      });
    });
  });

  describe('#update and read Entity()', function () {
    //called after each test to delete the database
    afterEach(function () {

      if (fs.existsSync(dbName))
        fs.unlinkSync(dbName);

    });

    it('should reject with 404 error when pdating data by and id and entity type that is not there', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      storage.init(storeConf, function () {
        storage.updateEntityPromise("unexistent-stuff", "user", {})
          .then(function (result) {
            throw Error("should not give results");
          }, function reject(error) {
            if (error.statusCode == 404) {
              done();
            }
          });
      });
    });

    it('should update the  data by an id and entity type', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "data": "string",
        "item": 123
      };
      var data2 = {
        "data": "string222",
        "item": 8554
      };
      storage.init(storeConf, function () {
        var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
        p.then(function (data) {
          storage.updateEntityPromise(entity_id, entity_type, data2)
            .then(function (result) {
              if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
                delete result.id; //id is included so remove it to check
                delete result.type; //entity type is included so remove it to check
                delete result.owner; //owner is included so remove it to check
                if (deepdif.diff(data2, result) == undefined) {
                  storage.readEntityPromise(entity_id, entity_type)
                    .then(function (result) {
                      if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
                        delete result.id; //id is included so remove it to check
                        delete result.type; //entity type is included so remove it to check
                        delete result.owner; //owner is included so remove it to check
                        if (deepdif.diff(data2, result) == undefined) {
                          done();
                        }
                      }
                    });
                }
              }
            });
        }, function rej(r) {
          throw r;
        })
      });
    });
  });
  describe('#delete and read Entity()', function () {
    //called after each test to delete the database
    afterEach(function () {

      if (fs.existsSync(dbName))
        fs.unlinkSync(dbName);

    });

    it('should reject with 404 error when deleting and entity by and id and entity type that is not there', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      storage.init(storeConf, function () {
        storage.deleteEntityPromise("unexistent-stuff", "user")
          .then(function (result) {
            throw Error("should not give results");
          }, function reject(error) {
            if (error.statusCode == 404) {
              done();
            }
          });
      });
    });

    it('should delete the  data by an id and entity type', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "data": "string",
        "item": 123
      };
      var data2 = {
        "data": "string222",
        "item": 8554
      };
      storage.init(storeConf, function () {
        var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
        p.then(function (data) {
          storage.deleteEntityPromise(entity_id, entity_type).then(function () {
            return storage.readEntityPromise(entity_id, entity_type);
          }).then(function (result) {}, function rej(r) {
            if (r.statusCode == 404)
              done()

          });
        });
      });
    });
  });

  describe('#listEntitiesByAttribute()', function () {
    //called after each test to delete the database
    afterEach(function () {

      if (fs.existsSync(dbName))
        fs.unlinkSync(dbName);

    });

    it('should reject with 404 error when attempting to find entity by type and id that is not there', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      storage.init(storeConf, function () {
        storage.listEntitiesByAttributeValueAndType("unexistent-stuff", "user")
          .then(function (result) {
            throw Error("should not give results");
          }, function reject(error) {
            if (error.statusCode == 404) {
              done();
            }
          });
      });
    });

    it('should return one data by an id and type, if it has been previously stored', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      var datasecond = {
        "name": "mysecond attribute",
        "token": "123"
      };

      storage.init(storeConf, function () {
        var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
        p.then(function (d) {
          return storage.createEntityPromise("otherentity", entity_type, owner, datasecond);
        }).then(function (created) {
          storage.listEntitiesByAttributeValueAndType("name", "string")
            .then(function (result) {
              if (result.length == 1) {
                result = result[0];
                if (result.id == entity_id && result.type == entity_type && result.owner == owner) {
                  delete result.id; //id is included so remove it to check
                  delete result.type; //entity type is included so remove it to check
                  delete result.owner; //owner is included so remove it to check
                  if (deepdif.diff(data, result) == undefined)
                    done();
                }
              }

            });
        }, function rej(r) {
          console.error('a' + r);
          throw r;
        })
      });
    });

    it('should return more than one entity by an id and type, if it has been previously stored (case with two elements with the same attribute type and value)', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      var datasecond = {
        "name": "string",
        "token": "123"
      };
      storage.init(storeConf, function () {
        var p = storage.createEntityPromise(entity_id, entity_type, owner, data);
        p.then(function (d) {
          return storage.createEntityPromise("otherentity", entity_type, owner, datasecond);
        }).then(function (created) {
          storage.listEntitiesByAttributeValueAndType("name", "string")
            .then(function (array) {
              if (array.length == 2 && deepdif.diff(array[1], array[2])) {
                var count = 0;
                for (var i in array) {
                  result = array[i];
                  if ((result.id == entity_id || result.id == "otherentity") && result.type == entity_type && result.owner == owner) {
                    delete result.id; //id is included so remove it to check
                    delete result.type; //entity type is included so remove it to check
                    delete result.owner; //owner is included so remove it to check
                    if (deepdif.diff(data, result) == undefined || deepdif.diff(datasecond, result) == undefined)
                      count++;
                  }
                }
                if (count == 2)
                  done();
              }
            });
        }, function rej(r) {
          console.error('a' + r);
          throw r;
        })
      });
    });

  });

  describe('#Create amd Read Group()', function () {
    //called after each test to delete the database
    afterEach(function () {

      if (fs.existsSync(dbName))
        fs.unlinkSync(dbName);

    });

    it('should return a group, if it has been previously stored', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      var owner = "1";
      var group_name = "mygroup";
      var tmp;
      storage.init(storeConf, function () {
        var p = storage.createGroupPromise(group_name, owner);
        p.then(function (d) {
          tmp = d;
          return storage.readGroupPromise(group_name, owner);
        }).then(function (data) {
          if (data.group_name === group_name && data.owner === owner && deepdif.diff(data, tmp) == undefined) {
            done();
          }
        }, function rej(r) {
          console.error('a' + r);
          throw r;
        })
      });
    });

    it('should reject with 404 error when attempting to find entity by type and id that is not there', function (done) {
      var storeConf = {
        "dbName": dbName
      };

      var storage = new Sqlite3Storage();
      storage.init(storeConf, function () {
        storage.readGroupPromise("unexistent-stuff", "user")
          .then(function (result) {
            throw Error("should not give results");
          }, function reject(error) {
            if (error.statusCode == 404) {
              done();
            }
          });
      });
    });

  });

  describe('#Add and list entities in a Group', function () {
    //called after each test to delete the database
    afterEach(function () {

      if (fs.existsSync(dbName))
        fs.unlinkSync(dbName);

    });

    it('should reject with 404 error when attempting to place an unexistent entity in a group that exists', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var owner = "1";
      var group_name = "mygroup";
      var storage = new Sqlite3Storage();
      storage.init(storeConf, function () {
        storage.createGroupPromise(group_name, owner)
        .then(function(group){
              return storage.AddEntityToGroupByIdsPromise(group.id,"unexistent-stuff", "user")
        }).then(function (result) {
            throw Error("should not give results");
          }, function reject(error) {
            if (error.statusCode == 404) {
              done();
            }
          });
      });
    });

    it('should reject with 404 error when attempting to place an exitent entity in a group is not there', function (done) {
      var storeConf = {
        "dbName": dbName
      };
      var storage = new Sqlite3Storage();
      var owner = "1";
      var entity_id = "2";
      var entity_type = "user";
      var data = {
        "name": "string",
        "token": "123"
      };
      storage.init(storeConf, function () {
        storage.createEntityPromise(entity_id, entity_type, owner, data)
        .then(function(entity){
              return storage.AddEntityToGroupByIdsPromise("unexistent-group", entity.id, entity.type)
        }).then(function (result) {
            throw Error("should not give results");
          }, function reject(error) {
            if (error.statusCode == 404) {
              done();
            }
          });
      });
    });

  });

});
