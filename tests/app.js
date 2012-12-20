var assert = require("assert");
var request = require("supertest");

var app = require("../app.js").app;

describe('GET /', function(){
    it('should return HTML with 200 status', function(done){
	request(app)
            .get('/')
	    .expect('Content-Type', /html/)
            .expect(200)
            .end(function(err, res){
		done();
            });
    });
});
