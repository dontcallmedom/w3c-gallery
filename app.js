var express = require('express');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var app = express();
module.exports.app = app;
var fs = require('fs');

var eventQueue = [];
var hostname = "";
var Picture;

app.configure(function(){
    // Reading command line options
    var argv = require("optimist")
	.options('c', {
	    alias: 'config',
	default:'config.ini'}).argv;
    
    // Reading configuration file
    var config = require('iniparser').parseSync(argv.c);

    if (!config.hosting.hostname) { // TODO: check the value is valid
	hostname = config.hosting.hostname;
    }

    // checking whether storage directory exists and is writeable
    var storageDir = config.storage.directory;
    try {
	fs.writeFileSync(storageDir + ".test");
    } catch (e) {
	throw new Error(storageDir + " not writable");
    }

    // Connecting to Mongo database
    var mongoose = require('mongoose');
    mongoose.connect(config.mongo.host, config.mongo.dbname);
    module.exports.db = mongoose;
    var db = mongoose.connection;
    db.on('error', function (err) { throw new Error('MongoDb connection failed: ' + err) });

    // and loading schemas for it
    Picture = require('./model.js')(storageDir).Picture;

    emitter.setMaxListeners(0);
    app.use(express.logger());
    app.set('port', config.hosting.hostname.split(":")[2] ? config.hosting.hostname.split(":")[2] : process.env.PORT || 3000);
    app.use(express.bodyParser());
    app.use(express.static(__dirname + '/public/', { maxAge: 86400}));
    app.use('/camera', express.static(__dirname + '/public/camera/vanilla/', { maxAge: 86400}));
    app.use(errorHandler);
});

// Run on port 80 when in production mode
app.configure('production', function(){
    app.use(express.errorHandler()); 
    app.set('port', process.env.PORT || 80);
});

app.get('/', function(req, res) {
    fs.readFile(__dirname + '/public/index.html', 'utf8', function(err, content){
        res.send(content);
    });
});

app.get('/camera/', function(req, res) {
    fs.readFile(__dirname + '/public/camera/vanilla/index.html', 'utf8', function(err, content){
        res.send(content);
    });
});


app.post('/gallery', function(req, res, next) {
    if (!req.files || !req.files.image) {
	res.status(400).send("Missing image upload");
	return;
    }
    var picture = new Picture();
    if (req.body.title) {
	picture.title = req.body.title;
    }
    picture.attach('image', req.files.image, function(err) { 
	if (err) return next(err);
	picture.save(function(err) {
	    if (err) return next(err);
	    var pic = {
		"@type": "ImageObject",
		url: hostname + "/photos/" + picture._id,
		name: picture.title,
		width: picture.image.original.dims.w,
		height: picture.image.original.dims.h,
		datePublished: picture.added
	    }
	    eventQueue.push(pic);
	    emitter.emit("addpicture", pic, eventQueue.length);
	    res.statusCode = 201;
	    var photoPath = "/photos/" + picture._id;
	    res.set("Location", photoPath);
	    if (req.accepts('json')) {
		res.send({picture:{pic}});
	    } else {
		res.send('Post has been saved with file!');
	    }
	});
    })    
});

app.all('/gallery.:format?', function(req, res) {
    switch (req.params.format) {
	// When json, generate suitable data
    case 'json':
	Picture.find({}).sort('-added').exec(
	    function(err, pictures) {
		var formattedPictures = [];
		for (var i = 0; i < pictures.length; i++) {
		    var pic = pictures[i];
		    formattedPictures.push(
			{
			    "@type": "ImageObject",
			    url: hostname + "/photos/" + pic._id,
			    name: pic.title,
			    width: pic.image.original.dims.w,
			    height: pic.image.original.dims.h,
			    datePublished: pic.added
			});
		}
		res.jsonp({entries:formattedPictures});
	    });
	break;
    default:
	fs.readFile(__dirname + '/public/gallery.html', 'utf8', function(err, content){
            res.send(content);
	});
    }
});

app.get('/photos/:id', function(req, res) {
    Picture.findOne({_id: req.params.id}, function(err, pic) {
	if (pic) {
	    fs.readFile(pic.image.original.path, function(err, content){
		if (err) {
		    res.status(410);
		    res.send("Could not find saved picture " + pic._id + " on storage");
		} else {
		    if (pic.image.original.format) {
			res.setHeader("Content-Type", "image/" + pic.image.original.format.toLowerCase());
		    } else {
			res.setHeader("Content-Type", "image/jpeg");
		    }
		    res.send(content);
		}
	    });
	} else {
	    res.status(404);
	    res.send("Unknown picture " + req.params.id);
	}
    });
});

app.get('/stream', function(req, res) {
    res.setHeader("Content-Type", 'text/event-stream');
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.writeHead(200);
    // avoid timeout
    setInterval(function() { res.write(":\n"); }, 30000);
    emitter.on("addpicture", function(pic, id) {
	res.write("data: " + JSON.stringify(pic)+ "\n");
	res.write("id: " + id + "\n\n");
    });
});

function errorHandler (err, req, res, next) {
    res.status(500);
    if (req.accepts('json')) {
	res.send({error: err});
    } else {
	res.send(err);
    }
}

if (require.main === module) {
    app.listen(app.set('port'));
    console.log("Express server listening on port %d in %s mode", app.set('port'), app.settings.env);
}

