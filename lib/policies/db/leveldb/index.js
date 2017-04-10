var level = require('level');
var uuid = require("uuid/v4");
var transaction = require('level-transactions');
var dbHandle = null;
var policies = null;

var Promise = require('bluebird');

module.exports = {
    init: init,

    create: create,
    update: update,
    read: read,
    del: del
};

/**
 * Initializes the database
 *
 * @param settings the settings for the mongodb database.
 */
function init(settings) {
    var filename = settings.dbName;
    var that = this;
    //console.log("attempting to use file  "+filename + "_policies");
    return new Promise(function(resolve, reject) {
         if(!dbHandle){
           var options = {
             keyEncoding: 'utf8',
             valueEncoding: 'json'
           };
           dbHandle = level(filename + "_policies", options);
        }
        resolve();
    });
};

function read(id) {
    return new Promise(function(resolve, reject) {
        dbHandle.get(id, function (error, policy) {
              if (error && error.notFound){
                resolve(null);
              }
              else if(error){
                reject(error);
              }
              else if(policy){
                if(policy.pO){
                   resolve(policy);
                }
                else{
                   reject(new Error("ERROR: Entry for entity '"+id+"' has invalid format."));
                }
              }
              else{
                reject(new Error("unknown error while reading policy. error "+JSON.stringify(error)+" policy "+JSON.stringify(policy)));
              }
        });
    });
};

function create(id, policy) {
    //console.log("creating id "+id+" policy "+JSON.stringify(policy));
    return new Promise(function(resolve, reject) {
        var ret=  { _id: id, pO : policy, t:1};
        dbHandle.put(id,ret,function (error) {
          if(error){
            reject(error);
          }
          else{
            resolve(ret);
          }
        });
    });
};

function update(id, policy, uid) {
  //normally uid should be checked to match t.
  return new Promise(function(resolve, reject) {
    //console.log("creating id "+id+" policy "+JSON.stringify(policy));
      var ret=  { _id: id, pO : policy, t:1};
      dbHandle.put(id, ret, function (error) {
        if(error){
          reject(error);
        }
        else{
          resolve(ret);
        }
      });
  });
};

function del(id) {
    return new Promise(function(resolve, reject) {
         read(id).then(function(data){
           if(data){
             dbHandle.del(id, function (error) {
                 if(error) {
                     reject(error);
                 } else {
                     resolve(data);
                 }
             });
           }
           else{
              resolve(null);
           }
         }).catch(function(error){
            reject(error);
         });
    });
};
