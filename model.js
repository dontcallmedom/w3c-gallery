var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var Picture = new Schema({
    added: {type: Date , default: Date.now()}
});

var attachments = require('mongoose-attachments');

module.exports = function(storageDirectory) {
/*    Picture.plugin(attachments, {
	directory: storageDirectory,
	storage: {
	    providerName: 'localfs'
	},
	properties: {
	    image: {
		styles: {
		    original: {},
		    thumb: {
			thumbnail: '100x100^',
			gravity: 'center',
			extent: '100x100',
			'$format': 'jpg'}
		}
	    }
	}
    });*/
    mongoose.model('Picture', Picture);
    return {
	Picture: mongoose.model('Picture')
    };
};