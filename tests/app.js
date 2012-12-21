var assert = require("assert");
var request = require("supertest");
var app = require("../app.js").app;
var mongoose = require("../app.js").db;

var postTestPicture = function(pic) {
    return function (done) {
	request(app)
	    .post('/gallery')
	    .attach('image','test.jpg')
	    .expect(201)
	    .end(function(err, res){
		if (err) return done(err);
		pic.url = res.headers['location'];
		done();
	    });    
    };
}

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
    var pic = function(){};

    before(function() {
	mongoose.connection.db.dropDatabase();
    });
    describe('POST a picture', function() {
	it('should return with 201 status and location header set', postTestPicture(pic));
    });
    describe('GET it back', function() {
	before(postTestPicture(pic));
	it('should return a JPEG image with 200 status', function(done) {
	    request(app)
		.get(pic.url)
		.expect(200)
		.expect('Content-Type', "image/jpeg")
		.end(function(err, res){
		    if (err) return done(err);		
		    done();
		});
	});
    });
});

describe('POST a picture and look it up in gallery', function() {
    var pic = function(){};
    describe('GET gallery and find picture', function() {
	before(postTestPicture(pic));
	it('should return a JSON array that includes the just posted picture', function(done) {
	    request(app)
		.get('/gallery.json')
		.expect(200)
		.expect('Content-Type',/json/)
		.end(function(err, res) {
		    if (err) return done(err);
		    var pictures = res.body;
		    var found = false;
		    for (var i =0 ; i < pictures.length ; i++) {
			if (pictures[i].url == pic.url) {
			    found = true;
			    break;
			}
		    }
		    assert(found);
		    done();
		});
	});
    });
});

describe('POST to gallery without attachment', function() {
    it('should return with 400 status', function(done) {
	request(app)
	    .post('/gallery')
	    .expect(400)
	    .end(function(err, res){
		if (err) return done(err);
		done();
	    });
    });
});

describe('GET an inexistant picture', function() {
    it('should return 404', function(done) {
	request(app)
	    .get('/photos/foo')
	    .expect(404)
	    .end(function(err, res) {
		if (err) return done(err);
		done();
	    });
    });
});