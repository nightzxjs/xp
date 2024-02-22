const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: false},
    title: { type: String, required: true},
    content: { type: String, required: true},
    date: { type: String, required: true}
});

PostSchema.pre('save', function(next){
    next();
});


module.exports = mongoose.model('Post', PostSchema);