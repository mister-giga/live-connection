const express = require('express');
const cors = require('cors')
const app = express();

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 80;
const Validator = require('jsonschema').Validator;
const v = new Validator();
const jwt = require('jsonwebtoken');


//checks json body of external POST / request
const postPayload = {
    "id": "/postPayload",
    "type": "object",
    "properties": {
      "roomId": {"type": "string"},
      "name": {"type": "string"}
    },
    "required": ["name", "roomId"]
  };


app.get('/', (_, res) => {
    res.send('<h1>Welcome at live-connection</h1>');
});

app.post('/', (req, res) => {
    const projectName = req.headers['source-project-name'];
    const projectKey = req.headers['source-project-key'];
    
    let error = null;
    if(!exists(projectName)){
        error = "source-project-name header is missing";
    } else if(!exists(projectKey)){
        error = "source-project-key header is missing";
    } else if(!projectName.startsWith('live_connect_')) {
        error = `source-project-name must start with 'live_connect_'`
    } else {
        const projectRealKey = process.env[projectName];
        
        if(!Boolean(projectRealKey)){
            error = `${projectName} is not set as environment variable`
        } else if(projectRealKey !== projectKey) {
            error = 'provided project key is wrong'
        } else {
            const validationResult = v.validate(req.body, postPayload);

            if(!validationResult.valid){
                error = validationResult.errors.join('; ');
            } else {
                console.log(io.to(req.body.roomId).emit(req.body.name, req.body.payload ?? { }));
            }
        }
    }

    if(error){
        res.statusCode = 400;
        res.send(error);
        console.error(error);
    } else {
        res.send('message sent');
    }
});


io.on('connection', (socket) => {
    socket.on('auth', (token, cb) => {
        let error = null;

        try {            
            var decoded = jwt.verify(token,
                                process.env.jwt_secret,
                                {ignoreExpiration:true});

            const userId = decoded?.nameid;
            const role = decoded?.role?.toUpperCase();

            if(exists(userId) && exists(role)){
                socket.join(role);
                socket.join(`${role}_${userId}`);    
            } 
        } catch(ex) {
            error = String(ex);
        }

        const message = error ?? "authentificated";
        cb && cb(message);
        console.log(message);
    });
});

http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
    console.log('process.env START')
    console.log(process.env)
    console.log('process.env END')
});

function exists(value){
    return Boolean(value && typeof value === 'string' && value.trim());
}
