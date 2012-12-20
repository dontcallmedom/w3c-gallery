var assert = require("assert");
var request = require("supertest");
var app = require("../app.js").app;
var mongoose = require("../app.js").db;

describe('GET /', function(){
    it('should return HTML with 200 status', function(done){
	request(app)
	    .get('/')
	    .expect('Content-Type', /html/)
	    .expect(200)
	    .end(function(err, res){
		if (err) return done(err);
		    done();
	    });
    });
});

describe('POST a picture and GET it', function() {
    before(function() {
	mongoose.connection.db.dropDatabase();
    });
    var pic;
    describe('POST a picture', function() {
	it('should return with 201 status and location header set', function(done) {
	    request(app)
		.post('/gallery')
		.attach('image','test.jpg')
		.expect(201)
		.end(function(err, res){
		    if (err) return done(err);
		    done();
		});
	});
    });
    describe('GET it back', function() {
	before(function(done) {
	    request(app)
		.post('/gallery')
		.attach('image','test.jpg')
		.expect(201)
		.end(function(err, res) {
		    if (err) return done(err);
		    pic = res.headers["location"];
		    done();
		});
	});
	it('should return a JPEG image with 200 status', function(done) {
	    request(app)
		.get(pic)
		.expect(200)
		.expect('Content-Type', "image/jpeg")
		.end(function(err, res){
		    if (err) return done(err);		
		    done();
		});
	});
    });
});
