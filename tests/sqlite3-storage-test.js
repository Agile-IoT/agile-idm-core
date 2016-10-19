const assert = require('assert');
const deepdif = require('deep-diff');
const clone = require('clone');
const Sqlite3Storage	 = require('../lib/storage/sqlite3-storage.js');
const fs = require("fs");
const dbName = "database.db";


describe('Sqlite3Storage', function() {
  describe('#crudOperation()', function () {
    //called after each test to delete the database
    afterEach(function() {
        if(fs.existsSync(dbName))
          fs.unlinkSync(dbName);
    });

    it('should return without data and success == false when entity is not there', function (done) {
      var storeConf = {"dbName":dbName};
      var storage = new Sqlite3Storage();
        storage.init(storeConf, function(result){
      	if(result.success == true){
      		storage.crudOperation("unexistent-stuff", "user", storage.READ, undefined, function (result){
    	      if(result.success == false){
    		      done();
            }
            else throw result.error;
          });
    		}
    		else{
    			throw result.error;
  			}
      });
    });


    it('should return the  data by an id, if it has been previously stored', function (done) {
      var storeConf = {"dbName":dbName};
      var storage = new Sqlite3Storage();
      var data = {"data":123,"item":123,"owner":"1"};
      storage.init(storeConf,function(result){
      	if(result.success == true){
      		storage.crudOperation("1", "user", storage.CREATE, data, function (result){
    	      if(result.success == true){
    		      delete result.data.id;//id is included so remove it to check
    		      delete result.data.type;//entity type is included so remove it to check
    		      if(deepdif.diff(data,result.data) == undefined){
    			      storage.crudOperation("1", "user", storage.READ, "", function onReadFinished( result){
                  if(result.success == true){
                    delete result.data.id;//id is included so remove it to check
                    delete result.data.type;//entity type is included so remove it to check
          		      if(deepdif.diff(data,result.data) == undefined){
          			      //after reading the same element as it was created... then we are fine
          			      done();
          		      }
          		      else throw "data returned from READ, after CREATE doesn't match what I intended to store!";
                  }
          	      else throw result;
                });
    		      }
    		      else throw "data returned from CREATE doesn't match what I intended to store!";
            }
    	      else throw result;
          });
    		}
    		else throw result.error;
      });
    });


    it('should update the  data by an id', function (done) {
      var storeConf = {"dbName":dbName};
      var storage = new Sqlite3Storage();
      var data = {"data":123,"item":123,"owner":"1"};
      storage.init(storeConf, function(result){
      	if(result.success == true){
      		storage.crudOperation("1", "user", storage.CREATE, data, function(result){
            if(result.success == true){
    	        delete result.data.id;//id is included so remove it to check
    	        delete result.data.type;//entity type is included so remove it to check
    	        if(deepdif.diff(data,result.data) == undefined){
    		        data["new_thing"]="a";
    		        storage.crudOperation("1", "user", storage.UPDATE, data,function ( result){
                  if(result.success == true){
                    delete result.data.id;//id is included so remove it to check
                    delete result.data.type;//entity type is included so remove it to check
                    if(deepdif.diff(data,result.data) == undefined){
          	          storage.crudOperation("1", "user", storage.READ, "",function (result){
                        delete result.data.id;//id is included so remove it to check
                        delete result.data.type;//entity type is included so remove it to check
                        if(deepdif.diff(data,result.data) == undefined){
                	        done();
                        }
                        else throw "data was not updated succesfully. Data doesn't match what I intended to update";
                      });
          		      }
                    else throw "data returned from READ, after CREATE doesn't match what I intended to store!";
                  }
                  else throw result;
                });
    	        }
    	        else throw "data returned from CREATE doesn't match what I intended to store!";
            }
            else throw result;
          });
    		}
    		else throw result.error
      });
    });


    it('should delete the  data by an id', function (done) {
      var storeConf = {"dbName":dbName};
      var storage = new Sqlite3Storage();
      var data = {"data":123,"item":123,"owner":"1"};
      storage.init(storeConf, function(result){
      	if(result.success == true){
      		storage.crudOperation("1", "user", storage.CREATE, data, function  (result){
            if(result.success == true){
    	        delete result.data.id;//id is included so remove it to check
    	        delete result.data.type;//entity type is included so remove it to check
    	        if(deepdif.diff(data,result.data) == undefined){
    		        storage.crudOperation("1", "user", storage.READ, "", function( result){
                  if(result.success == true){
                    delete result.data.id;//id is included so remove it to check
                    delete result.data.type;//entity type is included so remove it to check
                    if(deepdif.diff(data,result.data) == undefined){
          	          storage.crudOperation("1", "user", storage.DELETE, "", function (result){
                        if(result.success == true){
                          storage.crudOperation("1", "user", storage.READ, "", function (result){
                            if(result.success == false){
                    	        done();
                            }
                            else throw "data was not removed succesfully. it is still there!";
                          });
                        }
                        else throw result;
                      });
                    }
                    else throw "data returned from READ, after CREATE doesn't match what I intended to store!";
                  }
                  else throw result;
                });
    	        }
    	        else throw "data returned from CREATE doesn't match what I intended to store!";
            }
            else throw result;
          });
    		}
    		else throw result.error;
      });
    });

    it('should return copies, and make copies of data (instead of references)', function (done) {
      var storeConf = {"dbName":dbName};
      var storage = new Sqlite3Storage();
      data = {"data":123,"item":123,"owner":"1"};
      storage.init(storeConf, function(result){
      	if(result.success == true){
      		storage.crudOperation("1", "user", storage.CREATE, data, function (result){
            if(result.success == true){
    	        delete result.data.id;//id is included so remove it to check
    	        delete result.data.type;//entity type is included so remove it to check
    	        originalData = clone(data);
    	        if(deepdif.diff(data,result.data) == undefined){
    		        data["new_thing"]="a";
    		        result.data["new_thing"]="b";
    		        storage.crudOperation("1", "user", storage.READ, "", function (originalData,data1,data2,result){
                  if(result.success == true){
          	        delete result.data.id;//id is included so remove it to check
          	        delete result.data.type;//entity type is included so remove it to check
          	        if(deepdif.diff(originalData,result.data) == undefined){
          		        done();
          	        }
                  }
                  else throw "data  not present after storing it!";
                }.bind(this,originalData, data,result.data));
    	        }
    	        else throw "data returned from CREATE doesn't match what I intended to store!";
            }
            else throw result;
          });
    		}
    		else throw result.error;
      });
    });
 });
 describe('#groupQueries()', function () {

 it('should return the  entities by some attribute type and value, if it has been previously stored', function (done) {
   var storeConf = {"dbName":dbName};
   var storage = new Sqlite3Storage();
   var data = {"data":123,"item":123,"owner":"1"};
   storage.init(storeConf,function(result){
     if(result.success == true){
       storage.crudOperation("1", "user", storage.CREATE, data, function (result){
         if(result.success == true){
           delete result.data.id;//id is included so remove it to check
           delete result.data.type;//entity type is included so remove it to check
           if(deepdif.diff(data,result.data) == undefined){
             var data2 = {"data":123,"item":123,"owner":"2"};
             storage.crudOperation("2", "user", storage.CREATE, data, function (result){
               if(result.success == true){
                 delete result.data.id;//id is included so remove it to check
                 delete result.data.type;//entity type is included so remove it to check
                 if(deepdif.diff(data,result.data) == undefined){
                            storage.listEntitiesByAttributeTypeAndValue ("owner", "1", function(result){
                               if(result.success){
                                  if(result.data.length == 1){
                                    if(result.data[0].owner == 1)
                                    return done();
                                  }
                               }
                               throw new Error("cannot find the entity by attribute or it has wrong value");
                            });
                 }
                 else throw "data returned from CREATE doesn't match what I intended to store!";
               }
               else throw result;
              });

           }
           else throw "data returned from CREATE doesn't match what I intended to store!";
         }
         else throw result;
       });
     }
     else throw result.error;
   });
 });
});
});
