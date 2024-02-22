require('dotenv').config()
const express = require('express');
const path = require('path');
const bodyparser = require('body-parser');
const session = require('express-session');
const { v4:uuidv4 } = require('uuid');

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, function(err) {
    if (err) {
        throw err;
    } else {
        console.log(`Successfully connected to ${MONGO_URI}`);
    }
})

const app = express();

const PORT = process.env.PORT || 8080;

const User = require('./user');
const Post = require('./post');

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:true}));

app.set('view engine', 'ejs');

//load static assets
app.use('/static', express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: uuidv4(),
    resave: false,
    saveUninitialized: true
}));

const intervals = [
    { label: 'ano', seconds: 31536000 },
    { label: 'mês', seconds: 2592000 },
    { label: 'dia', seconds: 86400 },
    { label: 'hora', seconds: 3600 },
    { label: 'minuto', seconds: 60 },
    { label: 'segundo', seconds: 1 }
];
  
function timeSince(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const interval = intervals.find(i => i.seconds < seconds);
  
    if (!interval) {
      return 'Recentemente'; // Intervalo não encontrado, tratamento de erro
    }
  
    const count = Math.floor(seconds / interval.seconds);
    if(interval.label == 'mês' && count !== 1) interval.label = 'mese';
    return `${count} ${interval.label}${count !== 1 ? 's' : ''} atrás`;
}     

app.get('/', async (req, res) => {
    const allPost = await Post.find({})

    res.render('index', { title: 'xp.dev - Home', logged: req.session.user, usernameLogged: req.session.name, allPost, timeSince});

})

app.get('/login', (req, res) => {
    if(req.session.user) return res.redirect('/');
    res.render('login', { title: 'xp.dev - Login'});
})

app.get('/cadastro', (req, res) => {
    if(req.session.user) return res.redirect('/');
    res.render('cadastro', { title: 'xp.dev - Cadastro'});
})

app.get('/publicar', async (req, res) => {
    if(!req.session.user) return res.redirect('/');

    const user = await User.findOne({email:req.session.user});

    res.render('publicar', { title: 'xp.dev - Publicar', logged: req.session.user, usernameLogged: req.session.name, id: user._id});
})

//logout route
app.get('/deslogar', (req, res) => {
    req.session.destroy(function(err){
        if(err) {
            console.log(err);
            res.send('Error');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/:username', async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username: username })

    if(!user) {
        return res.sendStatus(404);
    }

    const allPost = await Post.find({ username:username });

    res.render('user', { title: `xp.dev - ${user.username}`, username: user.username, logged: req.session.user, usernameLogged: req.session.name, allPost, timeSince})

})

app.get('/:username/:post', async (req, res) => {
    const username = req.params.username;
    const userPost = req.params.post;

    const user = await User.findOne({ username: username })
    const post = await Post.findOne({ username: username, title: userPost });

    if(!user) {
        return res.sendStatus(404);
    } else if(!post) {
        return res.sendStatus(404);
    }

    res.render('post', { title: `xp.dev - ${user.username}`, logged: req.session.user, usernameLogged: req.session.name, title: post.title.split("-").join(" "), content: post.content, author: post.username, date: timeSince(new Date(post.date))});

})


//login user
app.post('/login', (req, res) => {
    if(req.session.user) return res.redirect('/');
    const {email, password} = req.body;

    User.findOne({email}, (err, user) => {
        if (err) {
            res.render('login', { error: 'Error Authenticating User' });
        } else if (!user) {
            res.render('login', { error: 'User does not exist' });
        } else {
            user.isCorrectPassword(password, async (err, result) => {
                if (err) {
                    res.render('login', { error: 'Error Authenticating' });
                } else if (result) {
                    let user = await User.find({'email':email});
                    user.forEach(value => {
                        req.session.name = value.username;
                    });
                    req.session.user = email;
                    res.redirect('/');
                } else {
                    res.render('login', { error: 'Invalid email or password' });
                }
            });
        }
    })
})

app.post('/cadastro', (req, res) => {
    let {username, email, password} = req.body;
    
    const user = new User({username, email, password});
    
    if(password.length < 6) {
        res.render('cadastro', { error: 'Password Must be More Than 6 Characters'});
    } else {
        user.save(async err => {
            if (err) {
                res.render('cadastro', { error: 'Error Registering User' });
                console.log(err);
            } else {
                let user = await User.find({'email':email});
                user.forEach(value => {
                    req.session.name = value.username;
                });
                req.session.user = email;
                res.status(200).redirect('/')
            }
        });
    }

});

app.post('/publicar', async (req, res) => {
    const {username, title, content} = req.body;

    const titleTrated = title.trim().split(" ").join("-");

    const user = await User.findOne({username:username});

    if(!user) return res.sendStatus(404);

    if(req.session.user == user.email) {

        let date = new Date();

        const post = new Post({username, title: titleTrated, content, date});

        post.save(async err => {
            if (err) {
                res.render('publicar', { error: 'Error Registering User' });
                console.log(err);
            } else {
                res.status(200).redirect(`/${username}`);
            }
        });
    } else {
        return res.sendStatus(404);
    }
})

app.listen(PORT, () => console.log(`Server is running in port ${PORT}`));
