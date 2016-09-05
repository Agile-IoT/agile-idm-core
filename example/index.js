
var conf = require('./conf/api-conf');
var IdmCore = require('../index');


idmcore = new IdmCore(conf);
var token = "2493143689353019";
var action = "create";
var entity_type = "/Sensor";
var entity_id = "3";
var data = {
    "name": "Barack Obama",
    "token": "DC 20500"
};
var prom = idmcore.actionPromisse(token,action , entity_type , entity_id, data);
prom.then(function(data){
  console.log('data from api: '+JSON.stringify(data));
}, function(error){
  console.log('something went wrong: '+error);
})
