var IdmCore = require('../index');
const clone = require('clone');
var assert = require('assert');
const deepdif = require('deep-diff');
const createError = require('http-errors');
const fs = require('fs');
//conf for the API (components such as storage and authentication for the API may be replaced during tests)
const dbName = "database.db";
var conf = {
   "storage":{
        "dbName":dbName
   },
   "authentication":{
       "web-server":"nowhere...",

  },"schema-validation":[
    {
      "id": "/Sensor",
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "token": {"type": "string"}
      },
      "required": ["name"]
    }
  ]
};

//default data for the tests
var token = "6328602477442473";
var action = "create";
var entity_type = "/Sensor";
var entity_id = "323";
var entity_1 = {
    "name": "Barack Obam2a",
    "token": "DC 20500"
};

//mock ups to make unit instead of integration tests.
var authMockOK = {
  authenticateEntityPromise : function(credentials){
      var that = this;
      return new Promise (function (resolve, reject) {
              var result = {"user_id":"userid", "auth_type":"auth_type", "scope": ["1"]};
              resolve(result);
       });
  }
}
var PdpMockOk = {
   canRead : function (userInfo, entityInfo) {
         return  new Promise(function (resolve, reject){
              resolve();
         });
   },
   canWrite : function (userInfo, entityInfo) {
         return  new Promise(function (resolve, reject){
              resolve();
         });
   }
};

//Tests!
describe('Api', function() {


  describe('#createEntity and readEntity()', function () {

    afterEach(function() {
        if(fs.existsSync(dbName)){
          fs.unlinkSync(dbName);
        }
    });
    //called after each test to delete the database
    it('should create an entity by id and return the same afterwards', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null,PdpMockOk);
      var entity = clone(entity_1);
      idmcore.createEntity(token, entity_type, entity_id, entity)
        .then(function (data){
            return idmcore.readEntity(token, entity_type, entity_id);
        }).then(function (read){
            if(entity_id == read.id && "/Sensor" == read.type){
              delete read.id;
              delete read.type;
              if(deepdif.diff(read,entity) == undefined)
                 done()
            }
        },function handlereject(r){
            throw r;
      }).catch(function(err){
        throw err;
      });
    });

    /*it('should update an entity by id and return the same afterwards', function (done) {
      var idmcore = new IdmCore(conf);
      idmcore.setMocks(authMockOK, null, null,PdpMockOk);
      var entity = clone(entity_1);
      idmcore.createEntity(token, entity_type, entity_id, entity)
        .then(function (data){
            console.log('create ok')
            return idmcore.updateEntity(token, entity_type, entity_id, entity);
        }).then(function (read){
            if(entity_id == read.id && "/Sensor" == read.type){
              delete read.id;
              delete read.type;
              if(deepdif.diff(read,entity) == undefined)
                 done()
            }
        },function handlereject(r){
            throw r;
      }).catch(function(err){
        throw err;
      });
    });*/



  })

});
